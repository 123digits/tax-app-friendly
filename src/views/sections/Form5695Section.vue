<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import WizardStep from '../../components/WizardStep.vue';
import CurrencyInput from '../../components/CurrencyInput.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';
import type { Form5695 } from '../../../shared/types';

const router = useRouter();
const taxStore = useTaxReturnStore();

// Part I — Residential Clean Energy Credit (30%)
const solarElectric = ref(0);
const solarWaterHeating = ref(0);
const windEnergy = ref(0);
const geothermalHeatPump = ref(0);
const biomassFuel = ref(0);
const batteryStorageTech = ref(0);
const fuelCellCost = ref(0);
const fuelCellKw = ref(0);

// Part II — Energy Efficient Home Improvement Credit (30% w/ caps)
const insulationAirSealing = ref(0);
const exteriorWindows = ref(0);
const exteriorDoors = ref(0);
const homeEnergyAudit = ref(0);
const heatPumps = ref(0);
const biomassStoves = ref(0);
const centralAc = ref(0);
const furnaceBoiler = ref(0);

onMounted(async () => {
  if (!taxStore.data) await taxStore.load();
  const f: Form5695 = taxStore.data?.form5695 ?? {
    solarElectric: 0,
    solarWaterHeating: 0,
    windEnergy: 0,
    geothermalHeatPump: 0,
    biomassFuel: 0,
    batteryStorageTech: 0,
    fuelCellCost: 0,
    fuelCellKw: 0,
    insulationAirSealing: 0,
    exteriorWindows: 0,
    exteriorDoors: 0,
    homeEnergyAudit: 0,
    heatPumps: 0,
    biomassStoves: 0,
    centralAc: 0,
    furnaceBoiler: 0,
  };
  solarElectric.value = f.solarElectric;
  solarWaterHeating.value = f.solarWaterHeating;
  windEnergy.value = f.windEnergy;
  geothermalHeatPump.value = f.geothermalHeatPump;
  biomassFuel.value = f.biomassFuel;
  batteryStorageTech.value = f.batteryStorageTech;
  fuelCellCost.value = f.fuelCellCost;
  fuelCellKw.value = f.fuelCellKw;
  insulationAirSealing.value = f.insulationAirSealing;
  exteriorWindows.value = f.exteriorWindows;
  exteriorDoors.value = f.exteriorDoors;
  homeEnergyAudit.value = f.homeEnergyAudit;
  heatPumps.value = f.heatPumps;
  biomassStoves.value = f.biomassStoves;
  centralAc.value = f.centralAc;
  furnaceBoiler.value = f.furnaceBoiler;
});

async function save() {
  await (taxStore as any).savePayload('form-5695', {
    solarElectric: solarElectric.value,
    solarWaterHeating: solarWaterHeating.value,
    windEnergy: windEnergy.value,
    geothermalHeatPump: geothermalHeatPump.value,
    biomassFuel: biomassFuel.value,
    batteryStorageTech: batteryStorageTech.value,
    fuelCellCost: fuelCellCost.value,
    fuelCellKw: fuelCellKw.value,
    insulationAirSealing: insulationAirSealing.value,
    exteriorWindows: exteriorWindows.value,
    exteriorDoors: exteriorDoors.value,
    homeEnergyAudit: homeEnergyAudit.value,
    heatPumps: heatPumps.value,
    biomassStoves: biomassStoves.value,
    centralAc: centralAc.value,
    furnaceBoiler: furnaceBoiler.value,
  });
  router.push('/');
}
</script>

<template>
  <AppShell>
    <WizardStep
      title="Form 5695 — Residential Energy Credits"
      :step="1"
      :total-steps="1"
      :can-back="true"
      :can-next="true"
      next-label="Save &amp; return"
      @back="router.push('/')"
      @next="save"
    >
      <p class="mb-4">
        Form 5695 provides two separate residential energy credits. Part I
        (Residential Clean Energy Credit) is 30% of qualified spending on
        solar, wind, geothermal, biomass fuel, battery storage, and fuel
        cells (fuel cells are capped at $500 per half-kilowatt of capacity).
        Part II (Energy Efficient Home Improvement Credit) is 30% with
        annual caps: $1,200 aggregate for general improvements (windows
        capped at $600, doors at $500, audit at $150), plus a separate
        $2,000 cap for heat pumps and biomass stoves.
      </p>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-card-title>Part I — Residential Clean Energy Credit (30%)</v-card-title>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="solarElectric"
              label="Solar electric (PV) property"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="solarWaterHeating"
              label="Solar water heating property"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="windEnergy"
              label="Small wind energy property"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="geothermalHeatPump"
              label="Geothermal heat pump property"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="biomassFuel"
              label="Biomass fuel property"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="batteryStorageTech"
              label="Battery storage technology"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="fuelCellCost"
              label="Fuel cell property cost"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="fuelCellKw"
              type="number"
              label="Fuel cell capacity"
              suffix="kW"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card variant="outlined" class="mb-4 pa-3">
        <v-card-title>Part II — Energy Efficient Home Improvement Credit (30%)</v-card-title>
        <p class="mb-4 text-caption">
          General improvements share a $1,200 annual cap. Windows are also
          capped at $600, exterior doors at $500, and a home energy audit
          at $150. Heat pumps (including heat-pump water heaters) and
          biomass stoves share a separate $2,000 annual cap.
        </p>
        <v-row>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="insulationAirSealing"
              label="Insulation / air sealing materials"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="exteriorWindows"
              label="Exterior windows and skylights"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="exteriorDoors"
              label="Exterior doors"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="homeEnergyAudit"
              label="Home energy audit"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="centralAc"
              label="Central air conditioner"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="furnaceBoiler"
              label="Natural gas / propane / oil furnace or boiler"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="heatPumps"
              label="Heat pumps and heat-pump water heaters"
            />
          </v-col>
          <v-col cols="12" md="6">
            <CurrencyInput
              v-model="biomassStoves"
              label="Biomass stoves"
            />
          </v-col>
        </v-row>
      </v-card>
    </WizardStep>
  </AppShell>
</template>
