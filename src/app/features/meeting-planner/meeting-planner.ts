import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { GeocodingService } from '../../core/services/geocoding.service';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { GeoLocation } from '../../core/models/location.model';
import { CountryFlagPipe } from '../../core/pipes/country-flag.pipe';
import { calculateSolarPosition } from '../../core/astronomy/astronomy-engine';
import { Subscription } from 'rxjs';

interface TimeCell { utcHour:number; localHour:number; label:string; dateLabel:string; dayOffset:-1|0|1; state:'sleep'|'personal'|'work'|'extended'; }
interface PlannerRow { location:GeoLocation; localNow:string; offset:string; solar:string; cells:TimeCell[]; }

@Component({
 selector:'app-meeting-planner', standalone:true,
 imports:[CommonModule,DragDropModule,MatIconModule,CountryFlagPipe],
 changeDetection:ChangeDetectionStrategy.OnPush, templateUrl:'./meeting-planner.html', styleUrl:'./meeting-planner.css'
})
export class MeetingPlannerComponent implements OnDestroy {
 private readonly locationService=inject(LocationService);
 private readonly timeControlService=inject(TimeControlService);
 private readonly geocodingService=inject(GeocodingService);

 readonly activeDate=this.timeControlService.currentActiveDate;
 readonly locationSearch=signal('');
 readonly searchResults=signal<GeoLocation[]>([]);
 readonly isSearching=signal(false);
 readonly selectedUtcHour=signal(14);
 readonly selectedCities=signal<GeoLocation[]>(this.initialCities());
 readonly copyNotification=signal<string|null>(null);
 private searchTimer:ReturnType<typeof setTimeout>|null=null;
 private searchSubscription:Subscription|null=null;

 readonly rows=computed<PlannerRow[]>(()=>{
   const date=this.baseUtcDate();
   return this.selectedCities().map(location=>{
     const solar=calculateSolarPosition(date,location.latitude,location.longitude);
     return {location,localNow:this.formatLocal(date,location.timezone,true),offset:this.formatOffset(date,location.timezone),solar:(solar.altitudeDeg>=0?'+':'')+solar.altitudeDeg.toFixed(1)+'°',cells:Array.from({length:24},(_,hour)=>this.makeCell(date,location,hour))};
   });
 });
 readonly selectedInstant=computed(()=>{const d=new Date(this.baseUtcDate());d.setUTCHours(this.selectedUtcHour(),0,0,0);return d;});
 readonly selectedSummary=computed(()=>this.selectedCities().map(location=>{const instant=this.selectedInstant();return {location,time:this.formatLocal(instant,location.timezone,true),date:this.formatLocalDate(instant,location.timezone),state:this.classifyLocalHour(this.localHour(instant,location.timezone))};}));
 readonly availableCities=computed(()=>{const ids=new Set(this.selectedCities().map(c=>c.id));return this.locationService.allPresets.filter(c=>!ids.has(c.id));});

 private initialCities():GeoLocation[]{const p=this.locationService.allPresets;const ids=['san-francisco','new-york','london','tokyo'];const r=ids.map(id=>p.find(c=>c.id===id)).filter(Boolean) as GeoLocation[];return r.length>=2?r:p.slice(0,4);}
 private baseUtcDate():Date{const b=this.activeDate();return new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate(),0,0,0));}
 private makeCell(date:Date,location:GeoLocation,utcHour:number):TimeCell{
   const instant=new Date(date);instant.setUTCHours(utcHour,0,0,0);
   const localHour=this.localHour(instant,location.timezone);
   const localIso=new Intl.DateTimeFormat('en-CA',{timeZone:location.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);
   const utcIso=date.toISOString().slice(0,10);
   const dayOffset: -1|0|1=localIso<utcIso?-1:localIso>utcIso?1:0;
   return {utcHour,localHour,label:this.formatHour(localHour),dateLabel:dayOffset===0?'':dayOffset<0?'prev':'next',dayOffset,state:this.classifyLocalHour(localHour)};
 }
 private localHour(date:Date,timezone:string):number{const p=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);return Number(p.find(x=>x.type==='hour')?.value??0)+Number(p.find(x=>x.type==='minute')?.value??0)/60;}
 private formatLocal(date:Date,timezone:string,seconds=false):string{try{return new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{}),hourCycle:'h23'}).format(date);}catch{return '--:--';}}
 private formatLocalDate(date:Date,timezone:string):string{return new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',month:'short',day:'numeric'}).format(date);}
 private formatOffset(date:Date,timezone:string):string{try{return new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeZoneName:'shortOffset'}).formatToParts(date).find(x=>x.type==='timeZoneName')?.value??'UTC';}catch{return 'UTC';}}
 private formatHour(hour:number):string{const h=Math.floor(hour)%24;const m=Math.round((hour-Math.floor(hour))*60);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
 private classifyLocalHour(hour:number):TimeCell['state']{if(hour>=9&&hour<17)return 'work';if((hour>=7&&hour<9)||(hour>=17&&hour<19))return 'extended';if(hour>=22||hour<7)return 'sleep';return 'personal';}
 setHour(hour:number):void{this.selectedUtcHour.set(Math.max(0,Math.min(23,Math.round(hour))));}
 selectCell(cell:TimeCell):void{this.setHour(cell.utcHour);}
 dropCity(event:CdkDragDrop<GeoLocation[]>):void{if(event.previousIndex===event.currentIndex)return;this.selectedCities.update(c=>{const n=[...c];moveItemInArray(n,event.previousIndex,event.currentIndex);return n;});}
 addCity(location:GeoLocation):void{if(this.selectedCities().length>=8)return;this.selectedCities.update(c=>[...c,location]);this.locationSearch.set('');this.searchResults.set([]);}
 removeCity(id:string):void{if(this.selectedCities().length<=2)return;this.selectedCities.update(c=>c.filter(x=>x.id!==id));}
 onLocationSearch(value:string):void{this.locationSearch.set(value);if(this.searchTimer)clearTimeout(this.searchTimer);const q=value.trim();if(q.length<2){this.searchResults.set([]);this.isSearching.set(false);return;}this.searchTimer=setTimeout(()=>{this.searchSubscription?.unsubscribe();this.isSearching.set(true);this.searchSubscription=this.geocodingService.search(q,8).subscribe({next:r=>{this.searchResults.set(r.filter(x=>!this.selectedCities().some(c=>c.id===x.id)));this.isSearching.set(false);},error:()=>{this.searchResults.set([]);this.isSearching.set(false);}});},220);}
 copySelection():void{const lines=this.selectedSummary().map(x=>x.location.name+': '+x.time+' · '+x.date);const text='2πClock meeting time\n'+this.formatHour(this.selectedUtcHour())+' UTC\n\n'+lines.join('\n');if(typeof navigator!=='undefined'&&navigator.clipboard)navigator.clipboard.writeText(text).then(()=>{this.copyNotification.set('Time selection copied');setTimeout(()=>this.copyNotification.set(null),2200);});}
 ngOnDestroy():void{if(this.searchTimer)clearTimeout(this.searchTimer);this.searchSubscription?.unsubscribe();}
}