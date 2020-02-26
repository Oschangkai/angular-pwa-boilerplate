import { Share } from './models/share';
import { Joke } from './models/joke';
import { Component, OnInit, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { DataService } from './services/data.service';
import { Observable } from 'rxjs';
import * as msTeams from "@microsoft/teams-js";
import { IDBPDatabase, OpenDBCallbacks, DBSchema, openDB } from 'idb';
import { tap } from 'rxjs/operators';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  isIdbSupported: boolean;
  isCameraSupported: boolean;
  jokes$: Observable<Joke>;
  jokes: string;
  sharesData$: Observable<Share>;
  identity: msTeams.Context;
  db: IDBPDatabase<MyTestDatabase>;
  savedJokes: MyTestDatabase["jokes"]["value"][];
  filteredJokes: MyTestDatabase["jokes"]["value"][];
  videoSize: {height: number, width: number} = {
    height: 0,
    width: 0
  }
  @ViewChild('canvas', { static: true }) canvas: ElementRef;
  @ViewChild('livecam', { static: true }) liveCam: ElementRef;
  
  constructor(
    private dataService: DataService,
    private renderer: Renderer2
  ) {}

  ngOnInit() {

    this.jokes$ = this.dataService.getJoke().pipe(
      tap((res: Joke) => {
        this.jokes = res.joke
      })
    );
    this.sharesData$ = this.dataService.getShares();

    msTeams.initialize();
    msTeams.getContext((Context: msTeams.Context) => {
      alert("getcontext call back function");
      this.identity = Context;
    });

    this.initDb();
    this.initCam();
  }

  async initDb() {

    if (!('indexedDB' in window)) {
      alert("IndexedDB not supported!!");
      this.isIdbSupported = false;
      return;
    }
    this.isIdbSupported = true;
    this.db = await openDB<MyTestDatabase>("MyTestDatabase", 1, this.idbOptions);
  }

  initCam() {
  // https://www.dev6.com/angular/capturing-camera-images-with-angular/
    if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { 
      navigator.mediaDevices.getUserMedia(this.mediaConstrains)
        .then(this.attachVideo.bind(this))
        .catch(err => console.log(err));
      this.isCameraSupported = true;
    } else {
        alert('Camera API not available.');
        this.isCameraSupported = false;
    }
  }

  attachVideo(stream) {
    this.renderer.setProperty(this.liveCam.nativeElement, 'srcObject', stream);
    this.renderer.listen(this.liveCam.nativeElement, 'play', (event) => {
      this.videoSize.height = this.liveCam.nativeElement.videoHeight;
      this.videoSize.width = this.liveCam.nativeElement.videoWidth;
    });
  }

  idbOptions: OpenDBCallbacks<MyTestDatabase> = {

    upgrade(db, oldVer, newVer, tx) {
      console.log(`old version is ${oldVer}, current version is ${newVer}`);
      db.createObjectStore("jokes", { autoIncrement: true })
        .createIndex("idx_time", "create_time");
      db.createObjectStore("photos", { autoIncrement: true });
    }
  }

  mediaConstrains: MediaStreamConstraints = {
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  }

  async insertJoke() {

    if(!this.isIdbReady()) {
      return;
    }
    const tx = this.db.transaction("jokes", "readwrite");
    tx.store.add({
      quote: this.jokes,
      create_time: new Date()
    }).then(() => alert("Saved!"));
  }

  async showAllJokes() {

    if(!this.isIdbReady()) {
      return;
    }
    
    const tx = this.db.transaction("jokes", "readonly");
    this.savedJokes = await tx.store.getAll();
    this.filteredJokes = undefined;
  }

  async showJoke(days: number) {

    if(!this.isIdbReady()) {
      return;
    }
    await this.showAllJokes();
    this.filteredJokes = this.savedJokes.filter(el => {
      let date = ( d => new Date(d.setDate(d.getDate()-days)) )(new Date);
      return el.create_time.getDate() == date.getDate();
    });
  }

  isIdbReady(): boolean {
    if(this.db !== undefined) {
      return true;
    }
    if(!this.isIdbSupported) {
      alert("IndexedDB not supported!!");
      return false;
    }
    alert("IndexedDB not initialized!!");
    return false;
  }

  capture() {
    this.renderer.setProperty(this.canvas.nativeElement, 'width', this.videoSize.width);
    this.renderer.setProperty(this.canvas.nativeElement, 'height', this.videoSize.height);
    this.canvas.nativeElement.getContext('2d').drawImage(this.liveCam.nativeElement, 0, 0);
  }
}
interface MyTestDatabase extends DBSchema {
  "jokes": {
    key: number;
    value: {
      quote: string;
      create_time: Date;
    };
    indexes: { "idx_time": Date };
  };
  "photos": {
    key: number;
    value: {

    };
    indexes: {  };
  }
}
