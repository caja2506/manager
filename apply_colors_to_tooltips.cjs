const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'projects', 'TimingStudyManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    // --- 1. card-objDia ---
    {
        search: `<span className="text-violet-400">Obj/Día (Neto)</span> = <span className="text-violet-400">Demanda Anual</span> ÷ <span className="text-slate-400">Días/Año</span>`,
        replace: `<span className="text-emerald-400">Obj/Día (Neto)</span> = <span className="text-blue-400">Demanda Anual</span> ÷ <span className="text-slate-400">Días/Año</span>`
    },
    {
        search: `<span className="text-violet-400">Obj/Día (Neto)</span> = <span className="text-blue-400">PPH_neto</span> × <span className="text-slate-400">Hrs/Día</span>`,
        replace: `<span className="text-emerald-400">Obj/Día (Neto)</span> = <span className="text-emerald-400">PPH_neto</span> × <span className="text-slate-400">Hrs/Día</span>`
    },
    {
        search: `<span className="text-violet-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-slate-400">{diasAnuales}</span> = <span className="text-violet-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span>`,
        replace: `<span className="text-blue-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-slate-400">{diasAnuales}</span> = <span className="text-emerald-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(shiftHours > 0 ? (Number(studyConfig?.targetPiecesPerShift || 0) / shiftHours) : 0).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> = <span className="text-violet-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span>`,
        replace: `<span className="text-emerald-400">{Math.round(shiftHours > 0 ? (Number(studyConfig?.targetPiecesPerShift || 0) / shiftHours) : 0).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> = <span className="text-emerald-400">{Math.round(piezasDia || 0).toLocaleString()} pzas/día</span>`
    },

    // --- 2. card-objHora ---
    {
        search: `<span className="text-blue-400">Obj/Hora (Bruto)</span> = <span className="text-violet-400">Obj/Día (Neto)</span> ÷ <span className="text-amber-500">OEE</span> ÷ <span className="text-slate-400">Hrs/Día</span>`,
        replace: `<span className="text-emerald-400">Obj/Hora (Bruto)</span> = <span className="text-emerald-400">Obj/Día (Neto)</span> ÷ <span className="text-amber-400">OEE</span> ÷ <span className="text-slate-400">Hrs/Día</span>`
    },
    {
        search: `<span className="text-blue-400">Obj/Hora (Bruto)</span> = <span className="text-blue-400">PPH_neto</span> ÷ <span className="text-amber-500">OEE</span>`,
        replace: `<span className="text-emerald-400">Obj/Hora (Bruto)</span> = <span className="text-emerald-400">PPH_neto</span> ÷ <span className="text-amber-400">OEE</span>`
    },
    {
        search: `<span className="text-violet-400">{Math.round(piezasDia || 0).toLocaleString()}</span> ÷ <span className="text-amber-500">{oeePercent}%</span> ÷ <span className="text-slate-400">{shiftHours}</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()} pzas/hr</span>`,
        replace: `<span className="text-emerald-400">{Math.round(piezasDia || 0).toLocaleString()}</span> ÷ <span className="text-amber-400">{oeePercent}%</span> ÷ <span className="text-slate-400">{shiftHours}</span> = <span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()} pzas/hr</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(shiftHours > 0 ? (piezasDia / shiftHours) : 0).toLocaleString()}</span> ÷ <span className="text-amber-500">{oeePercent}%</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()} pzas/hr</span>`,
        replace: `<span className="text-emerald-400">{Math.round(shiftHours > 0 ? (piezasDia / shiftHours) : 0).toLocaleString()}</span> ÷ <span className="text-amber-400">{oeePercent}%</span> = <span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()} pzas/hr</span>`
    },

    // --- 3. card-ppmObj ---
    {
        search: `<span className="text-cyan-400">CPM_obj</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> ÷ <span className="text-slate-400">60</span> ÷ <span className="text-fuchsia-400">UP</span>`,
        replace: `<span className="text-purple-400">CPM_obj</span> = <span className="text-emerald-400">Obj/Hora (Bruto)</span> ÷ <span className="text-slate-400">60</span> ÷ <span className="text-red-400">UP</span>`
    },
    {
        search: `<span className="text-emerald-400">PPM_obj</span> = <span className="text-cyan-400">CPM_obj</span> × <span className="text-fuchsia-400">UP</span>`,
        replace: `<span className="text-emerald-400">PPM_obj</span> = <span className="text-purple-400">CPM_obj</span> × <span className="text-red-400">UP</span>`
    },
    {
        search: `<span className="text-cyan-400">CPM_obj</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> ÷ <span className="text-slate-400">60</span> ÷ <span className="text-fuchsia-400">{cycleOutputQty}</span> = <span className="text-cyan-400">{cpmTarget ? cpmTarget.toFixed(2) : 0} CPM</span>`,
        replace: `<span className="text-purple-400">CPM_obj</span> = <span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> ÷ <span className="text-slate-400">60</span> ÷ <span className="text-red-400">{cycleOutputQty}</span> = <span className="text-purple-400">{cpmTarget ? cpmTarget.toFixed(2) : 0} CPM</span>`
    },
    {
        search: `<span className="text-emerald-400">PPM_obj</span> = <span className="text-cyan-400">{cpmTarget ? cpmTarget.toFixed(2) : 0}</span> × <span className="text-fuchsia-400">{cycleOutputQty}</span> = <span className="text-emerald-400">{(cpmTarget * cycleOutputQty).toFixed(1)} PPM</span>`,
        replace: `<span className="text-emerald-400">PPM_obj</span> = <span className="text-purple-400">{cpmTarget ? cpmTarget.toFixed(2) : 0}</span> × <span className="text-red-400">{cycleOutputQty}</span> = <span className="text-emerald-400">{(cpmTarget * cycleOutputQty).toFixed(1)} PPM</span>`
    },

    // --- 4. card-cicloTarget ---
    {
        search: `<span className="text-cyan-400">Ciclo Target (s)</span> = <span className="text-slate-400">60</span> / <span className="text-cyan-400">CPM_obj</span>`,
        replace: `<span className="text-indigo-400">Ciclo Target (s)</span> = <span className="text-slate-400">60</span> / <span className="text-purple-400">CPM_obj</span>`
    },
    {
        search: `<span className="text-cyan-400">Ciclo Target</span> = <span className="text-slate-400">60</span> / <span className="text-cyan-400">{cpmTarget ? cpmTarget.toFixed(2) : 0}</span> = <span className="text-cyan-400">{cicloTargetSeg ? cicloTargetSeg.toFixed(2) : 0} s</span>`,
        replace: `<span className="text-indigo-400">Ciclo Target</span> = <span className="text-slate-400">60</span> / <span className="text-purple-400">{cpmTarget ? cpmTarget.toFixed(2) : 0}</span> = <span className="text-indigo-400">{cicloTargetSeg ? cicloTargetSeg.toFixed(2) : 0} s</span>`
    },

    // --- 5. card-cicloReal ---
    {
        search: `<span className="text-cyan-400">Ciclo Real</span> = <span className="text-cyan-400">Dwell</span> + <span className="text-cyan-400">Index</span>`,
        replace: `<span className="text-indigo-400">Ciclo Real</span> = <span className="text-indigo-400">Dwell</span> + <span className="text-indigo-400">Index</span>`
    },
    {
        search: `<span className="text-cyan-400">Ciclo Real</span> = <span className="text-cyan-400">Dwell</span>`,
        replace: `<span className="text-indigo-400">Ciclo Real</span> = <span className="text-indigo-400">Dwell</span>`,
        allowMultiple: true
    },
    {
        search: `<span className="text-cyan-400">Ciclo Real</span> = <span className="text-cyan-400">{localMetrics?.dwellTimeMs || 0}ms</span> + <span className="text-cyan-400">{studyConfig?.mainIndexTimeMs || 0}ms</span> = <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>`,
        replace: `<span className="text-indigo-400">Ciclo Real</span> = <span className="text-indigo-400">{localMetrics?.dwellTimeMs || 0}ms</span> + <span className="text-indigo-400">{studyConfig?.mainIndexTimeMs || 0}ms</span> = <span className="text-indigo-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>`
    },
    {
        search: `<span className="text-cyan-400">Ciclo Real</span> = <span className="text-cyan-400">{localMetrics?.dwellTimeMs || 0}ms</span> = <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>`,
        replace: `<span className="text-indigo-400">Ciclo Real</span> = <span className="text-indigo-400">{localMetrics?.dwellTimeMs || 0}ms</span> = <span className="text-indigo-400">{localMetrics?.machineCycleTimeMs || 0}ms ({((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s)</span>`
    },

    // --- 6. card-ppmReal ---
    {
        search: `<span className="text-cyan-400">CPM_real</span> = <span className="text-slate-400">60</span> / <span className="text-cyan-400">Ciclo Real (s)</span>`,
        replace: `<span className="text-purple-400">CPM_real</span> = <span className="text-slate-400">60</span> / <span className="text-indigo-400">Ciclo Real (s)</span>`
    },
    {
        search: `<span className="text-emerald-400">PPM_real</span> = <span className="text-cyan-400">CPM_real</span> × <span className="text-fuchsia-400">UP</span>`,
        replace: `<span className="text-emerald-400">PPM_real</span> = <span className="text-purple-400">CPM_real</span> × <span className="text-red-400">UP</span>`
    },
    {
        search: `<span className="text-cyan-400">CPM_real</span> = <span className="text-slate-400">60</span> / <span className="text-cyan-400">{cicloRealSeg.toFixed(2)}s</span> = <span className="text-cyan-400">{cpmReal.toFixed(1)} CPM</span>`,
        replace: `<span className="text-purple-400">CPM_real</span> = <span className="text-slate-400">60</span> / <span className="text-indigo-400">{cicloRealSeg.toFixed(2)}s</span> = <span className="text-purple-400">{cpmReal.toFixed(1)} CPM</span>`
    },
    {
        search: `<span className="text-emerald-400">PPM_real</span> = <span className="text-cyan-400">{cpmReal.toFixed(1)}</span> × <span className="text-fuchsia-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className="text-emerald-400">{ppmReal.toFixed(1)} PPM</span>`,
        replace: `<span className="text-emerald-400">PPM_real</span> = <span className="text-purple-400">{cpmReal.toFixed(1)}</span> × <span className="text-red-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className="text-emerald-400">{ppmReal.toFixed(1)} PPM</span>`
    },

    // --- 7. card-bottleneck ---
    {
        search: `<span className="text-cyan-400">Bottleneck</span> = max(<span className="text-cyan-400">T_estación_i</span>)`,
        replace: `<span className="text-indigo-400">Bottleneck</span> = max(<span className="text-indigo-400">T_estación_i</span>)`
    },
    {
        search: `<span className="text-cyan-400">Bottleneck</span> = max(<span className="text-amber-500">{localMetrics?.bottleneckStationLabel || '—'}</span>) = <span className="text-cyan-400">{localMetrics?.dwellTimeMs || 0}ms ({((localMetrics?.dwellTimeMs || 0) / 1000).toFixed(2)}s)</span>`,
        replace: `<span className="text-indigo-400">Bottleneck</span> = max(<span className="text-amber-400">{localMetrics?.bottleneckStationLabel || '—'}</span>) = <span className="text-indigo-400">{localMetrics?.dwellTimeMs || 0}ms ({((localMetrics?.dwellTimeMs || 0) / 1000).toFixed(2)}s)</span>`
    },

    // --- 8. card-realHora ---
    {
        search: `<span className="text-emerald-400">PPH_real</span> = (<span className="text-slate-400">3,600,000</span> / <span className="text-cyan-400">Ciclo Real (ms)</span>) × <span className="text-fuchsia-400">UP</span>`,
        replace: `<span className="text-emerald-400">PPH_real</span> = (<span className="text-slate-400">3,600,000</span> / <span className="text-indigo-400">Ciclo Real (ms)</span>) × <span className="text-red-400">UP</span>`
    },
    {
        search: `<span className="text-emerald-400">PPH_real</span> = (<span className="text-slate-400">3,600,000</span> / <span className="text-cyan-400">{localMetrics?.machineCycleTimeMs || 1}ms</span>) × <span className="text-fuchsia-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className="text-emerald-400 font-bold">{Math.round(realPPH).toLocaleString()} pzas/hr</span>`,
        replace: `<span className="text-emerald-400">PPH_real</span> = (<span className="text-slate-400">3,600,000</span> / <span className="text-indigo-400">{localMetrics?.machineCycleTimeMs || 1}ms</span>) × <span className="text-red-400">{studyConfig?.cycleOutputQty || 1}</span> = <span className="text-emerald-400 font-bold">{Math.round(realPPH).toLocaleString()} pzas/hr</span>`
    },

    // --- 9. card-status ---
    {
        search: `<span className="text-cyan-400">Status</span> = <span className="text-cyan-400">Ciclo Real (s)</span> ≤ <span className="text-cyan-400">Ciclo Target (s)</span>`,
        replace: `<span className="text-purple-400">Status</span> = <span className="text-indigo-400">Ciclo Real (s)</span> ≤ <span className="text-indigo-400">Ciclo Target (s)</span>`
    },
    {
        search: `<span className="text-cyan-400">{((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s</span> ≤ <span className="text-cyan-400">{cicloTargetSeg.toFixed(2)}s</span> ⇒ <span className={\`font-bold \${localMetrics?.status === 'OK' ? 'text-emerald-400' : 'text-rose-400'}\`}>{localMetrics?.status || '—'}</span>`,
        replace: `<span className="text-indigo-400">{((localMetrics?.machineCycleTimeMs || 0) / 1000).toFixed(2)}s</span> ≤ <span className="text-indigo-400">{cicloTargetSeg.toFixed(2)}s</span> ⇒ <span className={\`font-bold \${localMetrics?.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}\`}>{localMetrics?.status || '—'}</span>`
    },

    // --- 10. card-piezasDia ---
    {
        search: `<span className="text-violet-400">Demanda/Día</span> = <span className="text-violet-400">Demanda Anual</span> ÷ <span className="text-slate-400">Días Anuales</span>`,
        replace: `<span className="text-blue-400">Demanda/Día</span> = <span className="text-blue-400">Demanda Anual</span> ÷ <span className="text-slate-400">Días Anuales</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Día (Target)</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-amber-500">OEE</span>`,
        replace: `<span className="text-emerald-400">Neta/Día (Target)</span> = <span className="text-emerald-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-amber-450">OEE</span>`
    },
    {
        search: `<span className="text-blue-400">Bruta/Día (Target)</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span>`,
        replace: `<span className="text-emerald-400">Bruta/Día (Target)</span> = <span className="text-emerald-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Día (Target)</span> = <span className="text-blue-400">Bruta/Día (Target)</span> × <span className="text-amber-500">OEE</span>`,
        replace: `<span className="text-emerald-400">Neta/Día (Target)</span> = <span className="text-emerald-400">Bruta/Día (Target)</span> × <span className="text-amber-450">OEE</span>`
    },
    {
        search: `<span className="text-violet-400">Demanda/Día</span> = <span className="text-violet-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-slate-400">{diasAnuales}</span> = <span className="text-violet-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`,
        replace: `<span className="text-blue-400">Demanda/Día</span> = <span className="text-blue-400">{Math.round(annualDemand).toLocaleString()}</span> ÷ <span className="text-slate-400">{diasAnuales}</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Día (Target)</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-amber-500">{oeePercent}%</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">Neta/Día (Target)</span> = <span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-amber-400">{oeePercent}%</span> = <span className="text-emerald-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">Bruta/Día (Target)</span> = <span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> = <span className="text-blue-400">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">Bruta/Día (Target)</span> = <span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> = <span className="text-emerald-400">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Día (Target)</span> = <span className="text-blue-400">{Math.round(piezasDiaSinOEE).toLocaleString()}</span> × <span className="text-amber-500">{oeePercent}%</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">Neta/Día (Target)</span> = <span className="text-emerald-400">{Math.round(piezasDiaSinOEE).toLocaleString()}</span> × <span className="text-amber-400">{oeePercent}%</span> = <span className="text-emerald-400">{Math.round(piezasDia).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(piezasDiaSinOEE).toLocaleString()} pzas</span>`,
        allowMultiple: true
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(piezasDia).toLocaleString()} pzas/día</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(piezasDia).toLocaleString()} pzas/día</span>`
    },

    // --- 11. card-piezasSem ---
    {
        search: `<span className="text-violet-400">Demanda/Sem</span> = <span className="text-violet-400">Demanda/Día</span> × <span className="text-slate-400">Días/Sem</span>`,
        replace: `<span className="text-blue-400">Demanda/Sem</span> = <span className="text-blue-400">Demanda/Día</span> × <span className="text-slate-400">Días/Sem</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Sem (Target)</span> = <span className="text-blue-400">Neta/Día (Target)</span> × <span className="text-slate-400">Días/Sem</span>`,
        replace: `<span className="text-emerald-400">Neta/Sem (Target)</span> = <span className="text-emerald-400">Neta/Día (Target)</span> × <span className="text-slate-400">Días/Sem</span>`
    },
    {
        search: `<span className="text-blue-400">Bruta/Sem (Target)</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-slate-400">Días/Sem</span>`,
        replace: `<span className="text-emerald-400">Bruta/Sem (Target)</span> = <span className="text-emerald-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-slate-400">Días/Sem</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Sem (Target)</span> = <span className="text-blue-400">Bruta/Sem (Target)</span> × <span className="text-amber-500">OEE</span>`,
        replace: `<span className="text-emerald-400">Neta/Sem (Target)</span> = <span className="text-emerald-400">Bruta/Sem (Target)</span> × <span className="text-amber-450">OEE</span>`
    },
    {
        search: `<span className="text-violet-400">Demanda/Sem</span> = <span className="text-violet-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-violet-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`,
        replace: `<span className="text-blue-400">Demanda/Sem</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-blue-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Sem (Target)</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-blue-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">Neta/Sem (Target)</span> = <span className="text-emerald-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-emerald-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-blue-400">{Math.round(pzSemBruto).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-slate-400">{studyConfig?.workDaysPerWeek !== undefined ? studyConfig.workDaysPerWeek : 5}</span> = <span className="text-emerald-400">{Math.round(pzSemBruto).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(pzSemBruto).toLocaleString()}</span> × <span className="text-amber-500">{oeePercent}%</span> = <span className="text-blue-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">{Math.round(pzSemBruto).toLocaleString()}</span> × <span className="text-amber-400">{oeePercent}%</span> = <span className="text-emerald-400">{Math.round(piezasSemana).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(pzSemBruto).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(pzSemBruto).toLocaleString()} pzas</span>`,
        allowMultiple: true
    },
    {
        search: `<span className="text-violet-400 font-bold">{Math.round(piezasSemana).toLocaleString()} pzas/sem</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(piezasSemana).toLocaleString()} pzas/sem</span>`
    },

    // --- 12. card-piezasAno ---
    {
        search: `<span className="text-violet-400">Demanda Anual</span> = (input primario)`,
        replace: `<span className="text-blue-400">Demanda Anual</span> = (input primario)`
    },
    {
        search: `<span className="text-blue-400">Neta/Año (Target)</span> = <span className="text-blue-400">Neta/Día (Target)</span> × <span className="text-slate-400">{diasAnuales} días</span>`,
        replace: `<span className="text-emerald-400">Neta/Año (Target)</span> = <span className="text-emerald-400">Neta/Día (Target)</span> × <span className="text-slate-400">{diasAnuales} días</span>`
    },
    {
        search: `<span className="text-blue-400">Bruta/Año (Target)</span> = <span className="text-blue-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-slate-400">{diasAnuales} días</span>`,
        replace: `<span className="text-emerald-400">Bruta/Año (Target)</span> = <span className="text-emerald-400">Obj/Hora (Bruto)</span> × <span className="text-slate-400">Hrs/Día</span> × <span className="text-slate-400">{diasAnuales} días</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Año (Target)</span> = <span className="text-blue-400">Bruta/Año (Target)</span> × <span className="text-amber-500">OEE</span>`,
        replace: `<span className="text-emerald-400">Neta/Año (Target)</span> = <span className="text-emerald-400">Bruta/Año (Target)</span> × <span className="text-amber-450">OEE</span>`
    },
    {
        search: `<span className="text-violet-400">Demanda Anual</span> = <span className="text-violet-400">{Math.round(annualDemand).toLocaleString()} pzas</span>`,
        replace: `<span className="text-blue-400">Demanda Anual</span> = <span className="text-blue-400">{Math.round(annualDemand).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">Neta/Año (Target)</span> = <span className="text-blue-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{diasAnuales}</span> = <span className="text-blue-400">{Math.round(piezasAno).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">Neta/Año (Target)</span> = <span className="text-emerald-400">{Math.round(piezasDia).toLocaleString()}</span> × <span className="text-slate-400">{diasAnuales}</span> = <span className="text-emerald-400">{Math.round(piezasAno).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-slate-400">{diasAnuales}</span> = <span className="text-blue-400">{Math.round(pzAnoBruto).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">{Math.round(piezasHoraTarget).toLocaleString()}</span> × <span className="text-slate-400">{shiftHours}</span> × <span className="text-slate-400">{diasAnuales}</span> = <span className="text-emerald-400">{Math.round(pzAnoBruto).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400">{Math.round(pzAnoBruto).toLocaleString()}</span> × <span className="text-amber-500">{oeePercent}%</span> = <span className="text-blue-400">{Math.round(piezasAno).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400">{Math.round(pzAnoBruto).toLocaleString()}</span> × <span className="text-amber-400">{oeePercent}%</span> = <span className="text-emerald-400">{Math.round(piezasAno).toLocaleString()} pzas</span>`
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(pzAnoBruto).toLocaleString()} pzas</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(pzAnoBruto).toLocaleString()} pzas</span>`,
        allowMultiple: true
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(piezasAno).toLocaleString()} pzas/año</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(piezasAno).toLocaleString()} pzas/año</span>`
    },
    {
        search: `<span className="text-blue-400 font-bold">{Math.round(piezasAno).toLocaleString()}</span>`,
        replace: `<span className="text-emerald-400 font-bold">{Math.round(piezasAno).toLocaleString()}</span>`,
        allowMultiple: true
    },
    {
        search: `<span className="text-violet-400 font-bold">{Math.round(annualDemand).toLocaleString()}</span>`,
        replace: `<span className="text-blue-400 font-bold">{Math.round(annualDemand).toLocaleString()}</span>`
    }
];

let applied = 0;
let missed = 0;

replacements.forEach((rep, idx) => {
    if (content.includes(rep.search)) {
        if (rep.allowMultiple) {
            content = content.split(rep.search).join(rep.replace);
        } else {
            content = content.replace(rep.search, rep.replace);
        }
        applied++;
    } else {
        console.log(`No se encontró el patrón #${idx + 1}:`, rep.search);
        missed++;
    }
});

if (applied > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Reemplazos completados: ${applied} aplicados, ${missed} no encontrados.`);
} else {
    console.log('No se pudo aplicar ningún reemplazo.');
}
