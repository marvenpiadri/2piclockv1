import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { CelestialService } from '../../core/services/celestial.service';
import { LocationService } from '../../core/services/location.service';
import { getCelestialState } from '../../core/astronomy/astronomy-engine';
import { ShareExportModalComponent } from '../../shared/components/share-export-modal/share-export-modal';

type Mode = 'wake' | 'bed' | 'now';
type Age = 'teen' | 'adult' | 'older' | 'senior';
interface Plan { cycles:number; sleepMinutes:number; inBedMinutes:number; bedtime:Date; wakeTime:Date; score:string; }
interface HistoryEntry { id:number; createdAt:string; mode:Mode; bedtime:string; wakeTime:string; sleepMinutes:number; cycles:number; location:string; timezone:string; }

@Component({selector:'app-sleep-calculator',standalone:true,imports:[CommonModule,FormsModule,ShareExportModalComponent],changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./sleep-calculator.html',styleUrl:'./sleep-calculator.css'})
export class SleepCalculatorComponent implements OnInit {
  private readonly title=inject(Title); private readonly meta=inject(Meta); private readonly platformId=inject(PLATFORM_ID);
  readonly locationService=inject(LocationService); readonly celestialService=inject(CelestialService);
  readonly mode=signal<Mode>('wake'); readonly age=signal<Age>('adult'); readonly showShareModal=signal(false); readonly wakeTime=signal('07:00'); readonly bedtime=signal('23:00'); readonly latency=signal(15); readonly history=signal<HistoryEntry[]>([]);
  readonly targetRange=computed(()=>this.age()==='teen'?{min:8,max:10,label:'8–10 h'}:this.age()==='adult'?{min:7,max:9,label:'7–9 h'}:this.age()==='older'?{min:7,max:9,label:'7–9 h'}:{min:7,max:8,label:'7–8 h'});
  readonly currentSky=computed(()=>{const a=this.celestialService.celestialState().sun.altitudeDeg;return a<-6?'Night sky':a<6?'Twilight':'Day sky';});
  readonly weatherContext=computed(()=>{const w=this.celestialService.currentWeather();return w?w.temperatureC+'°C · '+w.conditionLabel:'Weather loading';});
  readonly sunset=computed(()=>{const d=this.celestialService.celestialState().solarEvents.sunset;return d?this.formatTime(d):'—';});
  readonly plans=computed<Plan[]>(()=>{if(this.mode()==='now')return this.sleepNowPlans();const base=this.parseTime(this.mode()==='bed'?this.bedtime():this.wakeTime());const forward=this.mode()==='bed';return [4,5,6].map(cycles=>{const sleep=cycles*90;const inBed=sleep+this.latency();const bed=forward?base:new Date(base.getTime()-inBed*60000);const wake=forward?new Date(base.getTime()+inBed*60000):base;const hours=sleep/60;const r=this.targetRange();return {cycles,sleepMinutes:sleep,inBedMinutes:inBed,bedtime:bed,wakeTime:wake,score:hours>=r.min&&hours<=r.max?'recommended':hours<r.min?'short':'long'};});});
  readonly bestPlan=computed(()=>{const r=this.targetRange();return [...this.plans()].sort((a,b)=>Math.abs(a.sleepMinutes/60-(r.min+r.max)/2)-Math.abs(b.sleepMinutes/60-(r.min+r.max)/2))[0];});
  readonly sleepNowPlans=computed<Plan[]>(()=>{const now=new Date();const r=this.targetRange();return [4,5,6].map(cycles=>{const sleep=cycles*90;return {cycles,sleepMinutes:sleep,inBedMinutes:sleep+this.latency(),bedtime:now,wakeTime:new Date(now.getTime()+(sleep+this.latency())*60000),score:sleep/60>=r.min&&sleep/60<=r.max?'recommended':sleep/60<r.min?'short':'long'};});});
  readonly astronomyInsight=computed(()=>{
    const loc=this.locationService.selectedLocation();
    const plan=this.bestPlan();
    const bedState=getCelestialState(plan.bedtime,loc.latitude,loc.longitude,loc.timezone);
    const wakeState=getCelestialState(plan.wakeTime,loc.latitude,loc.longitude,loc.timezone);
    const moon=bedState.moon;
    const sunset=bedState.solarEvents.sunset;
    const sunrise=wakeState.solarEvents.sunrise;
    const civilDusk=bedState.solarEvents.civilDusk;
    const civilDawn=wakeState.solarEvents.civilDawn;
    const bedAfterSunset=sunset?Math.round((plan.bedtime.getTime()-sunset.getTime())/60000):null;
    const wakeBeforeSunrise=sunrise?Math.round((sunrise.getTime()-plan.wakeTime.getTime())/60000):null;
    const darkStart=civilDusk??sunset;
    const lightStart=civilDawn??sunrise;
    const darkWindow=darkStart&&lightStart?Math.max(0,Math.round((lightStart.getTime()-darkStart.getTime())/60000)):null;
    return {
      moonPhase:moon.phaseName,
      moonIllumination:Math.round(moon.illuminationFraction*100),
      moonAboveAtBed:moon.isAboveHorizon,
      dayLength:bedState.solarEvents.dayLengthMinutes,
      bedAfterSunset,
      wakeBeforeSunrise,
      darkWindow,
      solarEvidence:bedAfterSunset!==null&&bedAfterSunset>=0&&bedAfterSunset<=180?'Your planned bedtime is after sunset, when natural light is already declining.':bedAfterSunset!==null&&bedAfterSunset<0?'Your planned bedtime is before sunset; strong evening light may still be present.':'Sunset is not available for this date/location.',
      morningEvidence:wakeBeforeSunrise!==null&&wakeBeforeSunrise>=0&&wakeBeforeSunrise<=120?'Your wake time is before sunrise. Bright morning light after waking can help anchor the circadian clock.':wakeBeforeSunrise!==null&&wakeBeforeSunrise<0?'Your wake time is after sunrise, so natural morning light is already available.':'Sunrise is not available for this date/location.',
      lunarEvidence:moon.illuminationFraction>=0.8&&moon.isAboveHorizon?'A bright Moon is above the horizon around your planned bedtime. Research on lunar effects on human sleep is mixed, so treat this as an observation rather than a prediction.':'Lunar phase is shown for context; evidence for a direct human sleep effect remains inconsistent.'
    };
  });
  ngOnInit(){this.title.setTitle('Sleep Calculator | Bedtime & Wake Time | 2piClock');this.meta.updateTag({name:'description',content:'A transparent sleep calculator for bedtime, wake time, sleep cycles and sleep planning, enhanced with local solar, lunar and weather context.'});this.meta.updateTag({property:'og:title',content:'Sleep Calculator | 2piClock'});this.meta.updateTag({property:'og:description',content:'Plan sleep around your local time, sleep target and the real night sky.'});if(isPlatformBrowser(this.platformId)){try{const x=localStorage.getItem('2piclock-sleep-history');if(x)this.history.set(JSON.parse(x));}catch { /* Ignore non-fatal local persistence errors. */ }this.setWakeTimeFromNow();}}
  setMode(m:Mode){this.mode.set(m);if(m==='now')this.setWakeTimeFromNow();} setAge(v:Age){this.age.set(v);} setWakeTimeFromNow(){const d=new Date();d.setMinutes(d.getMinutes()+8);this.wakeTime.set(this.inputTime(d));}
  calculate(){this.save(this.bestPlan());} save(p:Plan){if(!isPlatformBrowser(this.platformId))return;const e={id:Date.now(),createdAt:new Date().toISOString(),mode:this.mode(),bedtime:p.bedtime.toISOString(),wakeTime:p.wakeTime.toISOString(),sleepMinutes:p.sleepMinutes,cycles:p.cycles,location:this.locationService.selectedLocation().name,timezone:this.locationService.selectedLocation().timezone};const next=[e,...this.history()].slice(0,20);this.history.set(next);localStorage.setItem('2piclock-sleep-history',JSON.stringify(next));}
  clearHistory(){this.history.set([]);if(isPlatformBrowser(this.platformId))localStorage.removeItem('2piclock-sleep-history');}
  formatHistoryTime(value:string,timezone?:string){return this.formatTime(new Date(value),timezone);}
  formatTime(d:Date,timezone=this.locationService.selectedLocation().timezone){return new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit',hour12:true}).format(d);}
  formatDuration(m:number){return Math.floor(m/60)+'h'+(m%60?' '+m%60+'m':'');}
  private parseTime(v:string){const [h,m]=v.split(':').map(Number);const d=new Date();d.setHours(h||0,m||0,0,0);if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);return d;} private inputTime(d:Date){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
}