import type { District, Hospital, Road, Station } from './types'
export const stations: Station[] = [
  { id: 'west', name: 'Westhaven', x: 195, y: 365, neighbors: ['north', 'central'] },
  { id: 'north', name: 'Northbank', x: 360, y: 120, neighbors: ['west', 'central'] },
  { id: 'central', name: 'Civic Grid', x: 465, y: 335, neighbors: ['west', 'north', 'east'] },
  { id: 'east', name: 'Eastgate', x: 705, y: 240, neighbors: ['central'] },
]
export const districts: District[] = [
  { id: 'oldtown', name: 'Old Town', station: 'west', population: 18400, x: 155, y: 250 },
  { id: 'harbor', name: 'Harbor District', station: 'west', population: 12800, x: 245, y: 465 },
  { id: 'northbank', name: 'Northbank', station: 'north', population: 24200, x: 370, y: 190 },
  { id: 'midtown', name: 'Midtown', station: 'central', population: 29600, x: 490, y: 265 },
  { id: 'southside', name: 'Southside', station: 'central', population: 19700, x: 525, y: 445 },
  { id: 'eastgate', name: 'Eastgate', station: 'east', population: 23700, x: 705, y: 365 },
]
export const roads: Road[] = [
  { id: 'r1', name: 'Westhaven Avenue', from: 'oldtown', to: 'northbank' },
  { id: 'r2', name: 'Harbor Link', from: 'oldtown', to: 'harbor' },
  { id: 'r3', name: 'Civic Boulevard', from: 'northbank', to: 'midtown' },
  { id: 'r4', name: 'South Bridge', from: 'harbor', to: 'southside' },
  { id: 'r5', name: 'Central Avenue', from: 'midtown', to: 'southside' },
  { id: 'r6', name: 'East Connector', from: 'midtown', to: 'eastgate' },
  { id: 'r7', name: 'Riverside Drive', from: 'southside', to: 'eastgate' },
]
export const hospitals: Hospital[] = [
  { id: 'mercy', name: 'Mercy General', district: 'oldtown', x: 245, y: 290 },
  { id: 'civic', name: 'Civic Medical', district: 'midtown', x: 565, y: 210 },
  { id: 'east', name: 'Eastgate Hospital', district: 'eastgate', x: 755, y: 430 },
]
export const population = districts.reduce((sum, d) => sum + d.population, 0)
