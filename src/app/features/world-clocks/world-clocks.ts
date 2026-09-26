import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { GeocodingService } from '../../core/services/geocoding.service';
import { MatIconModule } from '@angular/material/icon';
import { CountryFlagComponent } from '../../shared/components/country-flag/country-flag';
import { AnalogClockComponent } from '../../shared/components/analog-clock/analog-clock';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { GeoLocation } from '../../core/models/location.model';
import { WorldClockPreferencesService } from '../../core/services/world-clock-preferences.service';

type ClockStyle='digital'|'analog';
interface WorldClock { location:GeoLocation; hour:number; minute:number; second:number; hour24:number; time:string; offset:string; date:string; isDay:boolean; }

@Component({
 selector:'app-world-clocks', standalone:true,
 imports:[MatIconModule,CountryFlagComponent,FormsModule,DragDropModule],
 changeDetection:ChangeDetectionStrategy.OnPush, templateUrl:'./world-clocks.html', styleUrl:'./world-clocks.css'
})
export class WorldClocksComponent implements OnDestroy {
 private readonly locationService=inject(LocationService);
 private readonly timeControlService=inject(TimeControlService);
 private readonly geocodingService=inject(GeocodingService);
 private readonly preferences=inject(WorldClockPreferencesService);

 readonly activeDate=this.timeControlService.currentActiveDate;
 readonly style=signal<ClockStyle>('digital');
 readonly locationSearch=signal('');
 readonly locationResults=signal<GeoLocation[]>([]);
 readonly isSearching=signal(false);
 readonly pinnedLocations=this.preferences.pinnedLocations;
 private searchTimer:ReturnType<typeof setTimeout>|null=null;
 private searchSubscription:Subscription|null=null;

 readonly defaultLocations=computed(()=> {
   const defaults=['new-york','london','tokyo','casablanca','los-angeles'];
   return defaults.map(id=>this.locationService.allPresets.find(x=>x.id===id)).filter(Boolean) as GeoLocation[];
 });
 readonly displayedLocations=computed(()=> {
   const saved=this.pinnedLocations();
   return this.preferences.hasSavedPreferences()?saved:this.defaultLocations();
 });
 readonly displayedClocks=computed<WorldClock[]>(()=>{
   const instant=this.activeDate();
   return this.displayedLocations().map(location=>{
     const parts=new Intl.DateTimeFormat('en-US',{timeZone:location.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
     const hour24=Number(parts.find(x=>x.type==='hour')?.value??0);
     const minute=Number(parts.find(x=>x.type==='minute')?.value??0);
     const second=Number(parts.find(x=>x.type==='second')?.value??0);
     const offset=new Intl.DateTimeFormat('en-US',{timeZone:location.timezone,timeZoneName:'shortOffset'}).formatToParts(instant).find(x=>x.type==='timeZoneName')?.value??'UTC';
     const date=new Intl.DateTimeFormat('en-US',{timeZone:location.timezone,weekday:'short',month:'short',day:'numeric'}).format(instant);
     return {location,hour:hour24%12,minute,second,hour24,time:hour24.toString().padStart(2,'0')+':'+minute.toString().padStart(2,'0'),offset,date,isDay:hour24>=7&&hour24<19};
   });
 });
 readonly clockCount=computed(()=>this.displayedLocations().length);

 setStyle(style:ClockStyle):void{this.style.set(style);}
 selectLocation(location:GeoLocation):void{this.locationService.selectLocation(location);this.locationSearch.set('');this.locationResults.set([]);}
 isPinned(id:string):boolean{return this.pinnedLocations().some(x=>x.id===id);}
 pinLocation(location:GeoLocation):void{this.preferences.add(location);this.locationSearch.set('');this.locationResults.set([]);}
 removeLocation(id:string):void{this.preferences.remove(id);}
 dropClock(event:CdkDragDrop<GeoLocation[]>):void{if(event.previousIndex===event.currentIndex)return;this.preferences.reorder(event.previousIndex,event.currentIndex);}
 onLocationSearch(value:string):void{
   this.locationSearch.set(value); if(this.searchTimer)clearTimeout(this.searchTimer);
   const q=value.trim(); if(q.length<2){this.locationResults.set([]);this.isSearching.set(false);return;}
   this.searchTimer=setTimeout(()=>{this.searchSubscription?.unsubscribe();this.isSearching.set(true);
     this.searchSubscription=this.geocodingService.search(q,8).subscribe({next:r=>{this.locationResults.set(r);this.isSearching.set(false);},error:()=>{this.locationResults.set([]);this.isSearching.set(false);}});
   },220);
 }
 ngOnDestroy():void{if(this.searchTimer)clearTimeout(this.searchTimer);this.searchSubscription?.unsubscribe();}
}