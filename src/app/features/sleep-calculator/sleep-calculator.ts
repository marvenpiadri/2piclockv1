import { ChangeDetectionStrategy, Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { CelestialService } from '../../core/services/celestial.service';
import { LocationService } from '../../core/services/location.service';

type Mode = 'wake' | 'bed' | 'now';
type Age = 'teen' | 'adult' | 'older';
interface Plan { cycles:number; sleepMinutes:number; inBedMinutes:number; bedtime:Date; wakeTime:Date; score:string; }
interface HistoryEntry { id:number; createdAt:string; mode:Mode; bedtime:string; wakeTime:string; sleepMinutes:number; cycles:number; location:string; timezone:string; }

@Component({selector:'app-sleep-calculator',standalone:true,imports:[CommonModule,FormsModule],changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./sleep-calculator.html',styleUrl:'./sleep-calculator.css'})
export class SleepCalculatorComponent implements OnInit {
  private readonly title=inject(Title); private readonly meta=inject(Meta); private readonly platformId=inject(PLATFORM_ID);
  readonly locationService=inject(LocationService); readonly celestialService=inject(CelestialService);
  readonly mode=signal<Mode>('wake'); readonly age=signal<Age>('adult'); readonly wakeTime=signal('07:00'); readonly bedtime=signal('23:00'); readonly latency=signal(15); readonly history=signal<HistoryEntry[]>([]);
  readonly targetRange=computed(()=>this.age()==='teen'?{min:8,max:10,label:'8–10 h'}:this.age()==='older'?{min:7,max:9,label:'7–9 h'}:{min:7,max:9,label:'7+ h'});
  readonly currentSky=computed(()=>{const a=this.celestialService.celestialState().sun.altitudeDeg;return a<-6?'Night sky':a<6?'Twilight':'Day sky';});
  readonly weatherContext=computed(()=>{const w=this.celestialService.currentWeather();return w?`${w.temperatureC}°C · ${w.conditionLabel}`:'Weather loading';});
  readonly sunset=computed(()=>{const d=this.celestialService.celestialState().solarEvents.sunset;return d?this.formatTime(d):'—';});
  readonly plans=computed<Plan[]>(()=>{const base=this.parseTime(this.mode()==='bed'?this.bedtime():this.wakeTime());const forward=this.mode()==='bed';return [4,5,6].map(cycles=>{const sleep=cycles*90;const inBed=sleep+this.latency();const bed=forward?base:new Date(base.getTime()-inBed*60000);const wake=forward?new Date(base.getTime()+inBed*60000):base;const hours=sleep/60;const r=this.targetRange();return {cycles,sleepMinutes:sleep,inBedMinutes:inBed,bedtime:bed,wakeTime:wake,score:hours>=r.min&&hours<=r.max?'recommended':hours<r.min?'short':'long'};});});
  readonly bestPlan=computed(()=>{const r=this.targetRange();return [...this.plans()].sort((a,b)=>Math.abs(a.sleepMinutes/60-(r.min+r.max)/2)-Math.abs(b.sleepMinutes/60-(r.min+r.max)/2))[0];});
  readonly sleepNowPlans=computed(()=>{const now=new Date();return [4,5,6].map(cycles=>({cycles,bedtime:now,wakeTime:new Date(now.getTime()+(cycles*90+this.latency())*60000),sleepMinutes:cycles*90}));});
  ngOnInit(){this.title.setTitle('Sleep Calculator | Bedtime & Wake Time | 2piClock');this.meta.updateTag({name:'description',content:'A transparent sleep calculator for bedtime, wake time, sleep cycles and sleep planning, enhanced with your local 2piClock sky.'});this.meta.updateTag({property:'og:title',content:'Sleep Calculator | 2piClock'});this.meta.updateTag({property:'og:description',content:'Plan sleep around your local time, sleep target and night sky.'});if(isPlatformBrowser(this.platformId)){try{const x=localStorage.getItem('2piclock-sleep-history');if(x)this.history.set(JSON.parse(x));}catch{}this.setWakeTimeFromNow();}}
  setMode(m:Mode){this.mode.set(m);if(m==='now')this.setWakeTimeFromNow();} setAge(v:Age){this.age.set(v);} setWakeTimeFromNow(){const d=new Date();d.setMinutes(d.getMinutes()+8);this.wakeTime.set(this.inputTime(d));}
  calculate(){this.save(this.bestPlan());} save(p:Plan){if(!isPlatformBrowser(this.platformId))return;const e={id:Date.now(),createdAt:new Date().toISOString(),mode:this.mode(),bedtime:p.bedtime.toISOString(),wakeTime:p.wakeTime.toISOString(),sleepMinutes:p.sleepMinutes,cycles:p.cycles,location:this.locationService.selectedLocation().name,timezone:this.locationService.selectedLocation().timezone};const next=[e,...this.history()].slice(0,20);this.history.set(next);localStorage.setItem('2piclock-sleep-history',JSON.stringify(next));}
  clearHistory(){this.history.set([]);if(isPlatformBrowser(this.platformId))localStorage.removeItem('2piclock-sleep-history');}
  formatHistoryTime(value:string){return this.formatTime(new Date(value));}
  formatTime(d:Date){return new Intl.DateTimeFormat('en-US',{timeZone:this.locationService.selectedLocation().timezone,hour:'numeric',minute:'2-digit',hour12:true}).format(d);}
  formatDuration(m:number){return Math.floor(m/60)+'h'+(m%60?' '+m%60+'m':'');}
  private parseTime(v:string){const [h,m]=v.split(':').map(Number);const d=new Date();d.setHours(h||0,m||0,0,0);return d;} private inputTime(d:Date){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
}