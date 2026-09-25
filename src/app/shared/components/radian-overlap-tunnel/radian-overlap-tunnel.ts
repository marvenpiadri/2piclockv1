import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { calculateRadianTimeOverlap } from '../../../core/astronomy/astronomy-engine';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { GeoLocation } from '../../../core/models/location.model';

@Component({selector:'app-radian-overlap-tunnel',standalone:true,imports:[CommonModule],changeDetection:ChangeDetectionStrategy.OnPush,templateUrl:'./radian-overlap-tunnel.html',styleUrl:'./radian-overlap-tunnel.css'})
export class RadianOverlapTunnelComponent implements OnInit,OnChanges,OnDestroy {
 @Input() activeDate=new Date(); @Input() cities:GeoLocation[]=[];
 @ViewChild('unused',{static:false}) unused?:ElementRef;
 private platformId=inject(PLATFORM_ID); private locationService=inject(LocationService); private timeControl=inject(TimeControlService);
 overlapData:ReturnType<typeof calculateRadianTimeOverlap>={slots24h:[],sweetSpotWindows:[],bestWindow:null};
 readonly axisHours=[0,3,6,9,12,15,18,21,24];
 currentUtcHour=14; selectedCityId:string|null=null; private dragging=false;
 localTimes:Record<string,string>={}; workWindows:Record<string,{start:number;duration:number}>={};

 get effectiveCities(){return this.cities?.length?this.cities.slice(0,6):this.locationService.allPresets.slice(0,4)}
 ngOnInit(){this.updateOverlap();if(isPlatformBrowser(this.platformId)){window.addEventListener('pointermove',this.onPointerMove);window.addEventListener('pointerup',this.stopDrag);}}
 ngOnChanges(changes:SimpleChanges){if(changes['activeDate']||changes['cities']){this.updateOverlap();}}
 ngOnDestroy(){if(isPlatformBrowser(this.platformId)){window.removeEventListener('pointermove',this.onPointerMove);window.removeEventListener('pointerup',this.stopDrag)}}
 private updateOverlap(){const list=this.effectiveCities.map(c=>({id:c.id,name:c.name,flag:c.flag||'🌐',timezone:c.timezone}));this.overlapData=calculateRadianTimeOverlap(list,this.activeDate);this.currentUtcHour=this.activeDate.getUTCHours()+this.activeDate.getUTCMinutes()/60;this.refreshRows();}
 private refreshRows(){this.localTimes={};this.workWindows={};for(const city of this.effectiveCities){try{this.localTimes[city.id]=this.activeDate.toLocaleTimeString('en-US',{timeZone:city.timezone,hour:'2-digit',minute:'2-digit',hour12:false});const probe=new Date(Date.UTC(2026,0,1,this.activeDate.getUTCHours(),this.activeDate.getUTCMinutes()));const localHour=Number(new Intl.DateTimeFormat('en-US',{timeZone:city.timezone,hour:'2-digit',hourCycle:'h23'}).format(probe));this.workWindows[city.id]={start:(9-localHour+this.currentUtcHour+24)%24,duration:8};}catch{this.localTimes[city.id]='--:--';this.workWindows[city.id]={start:0,duration:8}}}}
 formatUtcH(h:number){const hh=Math.floor(h)%24;const mm=Math.round((h-Math.floor(h))*60);return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}
 selectCity(id:string){this.selectedCityId=id}
 startDrag(e:PointerEvent){e.preventDefault();this.dragging=true;this.updateFromPointer(e)}
 onTrackPointerDown(e:PointerEvent){this.updateFromPointer(e)}
 onPointerMove=(e:PointerEvent)=>{if(this.dragging)this.updateFromPointer(e)}
 stopDrag=()=>{this.dragging=false}
 private updateFromPointer(e:PointerEvent){const target=e.currentTarget as HTMLElement|null;const track=target?.classList.contains('day-track')?target:document.querySelector('.timeline-handle')?.parentElement?.querySelector('.day-track') as HTMLElement|null;if(!track)return;const r=track.getBoundingClientRect();this.currentUtcHour=Math.max(0,Math.min(23.999,((e.clientX-r.left)/r.width)*24));this.currentUtcHour=Math.round(this.currentUtcHour*4)/4;this.refreshRows()}
 nudge(step:number){this.currentUtcHour=Math.max(0,Math.min(23.75,this.currentUtcHour+step));this.refreshRows()}
}