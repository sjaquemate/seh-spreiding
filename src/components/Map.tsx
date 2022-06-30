import L, { LatLngExpression, LeafletEventHandlerFn, LeafletEventHandlerFnMap } from "leaflet"

import React, { useEffect, useState } from "react"
import { FC } from "react"
import {
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
} from 'react-leaflet'
import { areActiveHoursEqual, formatActiveHours, formatHour } from "../interfaces/hours"
import { IZiekenhuis } from "../interfaces/ziekenhuis"
import { RegioIndeling, regioIndelingOptions } from "../interfaces/regios"
import { RegioGeoJSON } from "./RegioGeoJSON"
import Control from "react-leaflet-custom-control"
import { useStoreState, useStoreActions } from "../states/store"
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { areInSameRoazegio } from "../processing/regios"
import FormGroup from "@mui/material/FormGroup"
import FormControlLabel from "@mui/material/FormControlLabel"
import Checkbox from "@mui/material/Checkbox"
import gevoeligeziekenhuizen from '../assets/gevoeligeziekenhuizen.json';
import stedelijkeziekenhuizen from '../assets/stedelijkeziekenhuizen.json';
import { NumberTextInput } from "./NumerTextField"
import Button from "@mui/material/Button"
import { FileUploadButton } from "./FileUploadButton"
import { InformationIcon } from "./InformationIcon"

const ziekenhuisSVG =
  '<svg xmlns="http://www.w3.org/2000/svg" stroke="black" stroke-width="4" fill="{mapIconColor}" viewBox="0 0 36 44" width="20" height="20"><path d="M18.664.253a1 1 0 0 0-1.328 0L.328 15.702a1 1 0 0 0-.328.74V44h36V16.443a1 1 0 0 0-.328-.74zM25 29h-4v4a3 3 0 0 1-6 0v-4h-4a3 3 0 0 1 0-6h4v-4a3 3 0 0 1 6 0v4h4a3 3 0 0 1 0 6z"/></svg>';

const center: LatLngExpression = [52.14, 5.109]
const zoom = 7.5

const ZiekenhuisMarker: FC<{
  ziekenhuis: IZiekenhuis,
  eventHandler: LeafletEventHandlerFnMap,
  isRegionalSelected?: boolean
  isSelected?: boolean
}> = ({ ziekenhuis, eventHandler, isRegionalSelected, isSelected }) => {

  const { open, close } = ziekenhuis.seh.currentActiveHours
  const label = `${formatHour(open)} ${formatHour(close)}`
  const size = 17

  const currentActiveHours = ziekenhuis.seh.currentActiveHours
  const defaultActiveHours = ziekenhuis.seh.defaultActiveHours
  const changedActiveHours = !areActiveHoursEqual(currentActiveHours, defaultActiveHours)

  const isSEHFormEmpty = ziekenhuis.seh.isSehFormEmpty
  let extraCSS = "fill-white"

  if (isSEHFormEmpty) {
    extraCSS = "fill-neutral-500 opacity-50"
  }
  else if (changedActiveHours) {
    extraCSS = "fill-orange-300"
  }
  else if (isRegionalSelected) {
    extraCSS = "fill-blue-500"
  }


  const svgStyle = `${extraCSS} stroke-[2] stroke-black`
  const ziekenhuisSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 44" ><path d="M18.664.253a1 1 0 0 0-1.328 0L.328 15.702a1 1 0 0 0-.328.74V44h36V16.443a1 1 0 0 0-.328-.74zM25 29h-4v4a3 3 0 0 1-6 0v-4h-4a3 3 0 0 1 0-6h4v-4a3 3 0 0 1 6 0v4h4a3 3 0 0 1 0 6z"/></svg>`

  const html = `
  <div class='flex flex-col  
              ${!isSEHFormEmpty && "transition ease-out hover:opacity-50 hover:scale-[1.3] duration-400"} 
              ${isSelected && "animate-bounce"}'> 
    <div class="${svgStyle}">
      ${ziekenhuisSvg}
    </div>
  </div>`

  //     ${ bo ? `<div class="flex justify-center text-[6px] text-red-600"> ${txt} </div>` : '' }

  const icon = L.divIcon({
    className: "bg-blue-500 bg-opacity-0", // "transition ease-in-out delay-0 hover:opacity-50 duration-300 bg-blue-100",
    html: html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return <Marker
    icon={icon}
    position={ziekenhuis.latlon}
    eventHandlers={eventHandler}

  >
    <Tooltip direction="right" offset={[20, 0]}>
      {ziekenhuis.locatie} <br />
      {formatActiveHours(currentActiveHours)}
    </Tooltip>
  </Marker>
}

export const Map = () => {

  const ziekenhuizen = useStoreState(state => state.ziekenhuizen)
  const selectedZiekenhuis = useStoreState(state => state.selectedZiekenhuis)
  const regioIndeling = useStoreState(state => state.regioIndeling)
  const currentYear = useStoreState(state => state.currentYear)

  const setSelectedZiekenhuis = useStoreActions(actions => actions.setSelectedZiekenhuis)
  const setRegioIndeling = useStoreActions(actions => actions.setRegioIndeling)
  const setZiekenhuisActiveOpenHour = useStoreActions(actions => actions.setZiekenhuisActiveOpenHour)
  const setZiekenhuisActiveCloseHour = useStoreActions(actions => actions.setZiekenhuisActiveCloseHour)

  const highlightedLatLon = selectedZiekenhuis?.latlon
  const currentRegioOption = regioIndelingOptions.find(option => option.value === regioIndeling)

  const [filter1, setFilter1] = useState(false)
  const [filter2, setFilter2] = useState(false)
  const [filter3, setFilter3] = useState(false)
  const [filter4, setFilter4] = useState(false)
  const [filter5, setFilter5] = useState(false)
  const [lowerSEHBezoekersBound, setLowerSEHBezoekersBound] = useState(18_000)
  const [lowerMidnightMaxDrukteBound, setLowerMidnightMaxDrukteBound] = useState(5)
  const [lowerMidnightGemDrukteBound, setLowerMidnightGemDrukteBound] = useState(5)

  useEffect(() => {
    ziekenhuizen.forEach(ziekenhuis => {
      if (ziekenhuis.seh.isSehFormEmpty) {
        return
      }

      const aantalSEHBezoeken = ziekenhuis.seh.sehForm[currentYear].aantalSEHBezoeken

      const maxWeekStapeldrukte = ziekenhuis.seh.sehForm[currentYear].stapeldruktePerDag.week.max
      const midnightMaxWeekDrukte = maxWeekStapeldrukte.find(({ hour, value }) => hour === 0)!.value

      const gemWeekStapeldrukte = ziekenhuis.seh.sehForm[currentYear].stapeldruktePerDag.week.gem
      const midnightGemWeekDrukte = gemWeekStapeldrukte.find(({ hour, value }) => hour === 0)!.value

      const shouldBeClosedBasedOnData = (
        // at least one filter is active and  
        ((filter1 ? 1 : 0) + (filter2 ? 1 : 0) + (filter3 ? 1 : 0) > 0) &&
        // the filter is active and the criteria is met or continue to next criteria
        (
          (filter1 ? aantalSEHBezoeken < lowerSEHBezoekersBound : true) &&
          (filter2 ? midnightMaxWeekDrukte < lowerMidnightMaxDrukteBound : true) &&
          (filter3 ? midnightGemWeekDrukte < lowerMidnightGemDrukteBound : true)
        )
      )

      const shouldStayOpen = (
        filter4 && gevoeligeziekenhuizen.includes(ziekenhuis.id)
      )
      const shouldStayClosed = (
        (filter5 && stedelijkeziekenhuizen.includes(ziekenhuis.id))
      )

      if ((!shouldStayOpen && shouldBeClosedBasedOnData) || shouldStayClosed) {
        setZiekenhuisActiveOpenHour({ ziekenhuis: ziekenhuis, open: 7 })
        setZiekenhuisActiveCloseHour({ ziekenhuis: ziekenhuis, close: 23 })
      }
      else {
        setZiekenhuisActiveOpenHour({ ziekenhuis: ziekenhuis, open: 0 })
        setZiekenhuisActiveCloseHour({ ziekenhuis: ziekenhuis, close: 24 })
      }
    })
  }, [filter1, filter2, filter3, filter4, filter5,
    lowerSEHBezoekersBound, lowerMidnightGemDrukteBound, lowerMidnightMaxDrukteBound])


  return (
    <MapContainer className="resize-x" center={center} zoom={zoom} zoomSnap={0.1}>

      <LayersControl position="topright">

        <LayersControl.BaseLayer name="Default">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer checked name="Grijs NL">
          <TileLayer
            url='https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?layer=grijs&style=default&tilematrixset=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:28992:{z}&TileCol={x}&TileRow={y}'
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Kleur NL">
          <TileLayer
            url='https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0?layer=standaard&style=default&tilematrixset=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:28992:{z}&TileCol={x}&TileRow={y}'
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Ziekenhuizen">
          <LayerGroup>
            {ziekenhuizen.map((ziekenhuis) => {

              const eventHandler = {
                click: () => {
                  if (!ziekenhuis.seh.isSehFormEmpty) {
                    setSelectedZiekenhuis(ziekenhuis)
                  }
                },
              }

              const isInSameRoazRegioAsSelected = selectedZiekenhuis && areInSameRoazegio(selectedZiekenhuis, ziekenhuis)

              return <React.Fragment key={ziekenhuis.id}>
                <ZiekenhuisMarker
                  ziekenhuis={ziekenhuis}
                  eventHandler={eventHandler}
                  isRegionalSelected={isInSameRoazRegioAsSelected}
                  isSelected={ziekenhuis === selectedZiekenhuis}
                />
              </React.Fragment>
            })}
          </LayerGroup>
        </LayersControl.Overlay>

      </LayersControl>

      <RegioGeoJSON regioIndeling={regioIndeling} highlightedLatLon={highlightedLatLon} />

      <Control position="bottomleft">
        <FileUploadButton />
      </Control>

      <Control position="bottomleft">

        <Button
          variant="contained"
          component="label"
          onClick={() => window.open("https://raw.github.com/sjaquemate/seh-spreiding/main/src/assets/SEH DATA 2018 en 2019_1.3_010522.pdf", "_blank")}
        >
          <div className="flex flex-row gap-2"> 
          <div> Download landelijk overzicht </div> <InformationIcon informationText="Download een .pdf bestand met het overzicht van alle SEH locaties waarvan data beschikbaar is gesteld."/>
          </div>
        </Button>
      </Control>


      <Control position="bottomleft">
        <div className="px-3 py-1 bg-slate-200"> selecteer regio indeling: </div>
        <div className="bg-white">
          <Select
            value={"Roaz"}
            label="Open"
          >
            <MenuItem value={"Roaz"}> {"Roaz"} </MenuItem>
          </Select>
        </div>
        <div className="px-3 py-1 bg-slate-200"> nachtsluiting filter: </div>
        <div className="px-3 bg-white">
          <FormGroup>
            <FormControlLabel
              label={
                <div className="flex flex-row gap-2 items-center">
                  <div> {"aantal SEH bezoeken < "} </div>

                  <div className="w-1/3"> <NumberTextInput
                    value={lowerSEHBezoekersBound}
                    setValue={setLowerSEHBezoekersBound}
                  />
                  </div>
                </div>
              }
              control={<Checkbox
                checked={filter1}
                onClick={(e) => { setFilter1(prev => !prev) }}
              />} />

            <FormControlLabel
              label={
                <div className="flex flex-row gap-2 items-center">
                  <div> {"maximale drukte 00:00h <"} </div>
                  <div className="w-1/3">
                    <NumberTextInput
                      value={lowerMidnightMaxDrukteBound}
                      setValue={setLowerMidnightMaxDrukteBound}
                    />
                  </div>
                </div>
              }
              control={
                <Checkbox
                  checked={filter2}
                  onClick={(e) => { setFilter2(prev => !prev) }}
                />
              }
            />
            <FormControlLabel
              label={
                <div className="flex flex-row gap-2 items-center">
                  <div> {"gemiddelde drukte 00:00h <"} </div>
                  <div className="w-1/3">
                    <NumberTextInput
                      value={lowerMidnightGemDrukteBound}
                      setValue={setLowerMidnightGemDrukteBound}
                    />
                  </div>
                </div>
              }
              control={
                <Checkbox
                  checked={filter3}
                  onClick={(e) => { setFilter3(prev => !prev) }}
                />
              }
            />

            <FormControlLabel
              label="houd gevoelige ziekenhuizen open"
              control={<Checkbox
                checked={filter4}
                onClick={(e) => { setFilter4(prev => !prev) }}
              />}
            />

            <FormControlLabel
              label="sluit stedelijke ziekenhuizen"
              control={<Checkbox
                checked={filter5}
                onClick={(e) => { setFilter5(prev => !prev) }}
              />}
            />
          </FormGroup>
        </div>
      </Control>




    </MapContainer>
  )
}
