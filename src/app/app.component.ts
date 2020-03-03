import { Share } from './models/share';
import { Joke } from './models/joke';
import { Component, OnInit, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { DataService } from './services/data.service';
import { Observable } from 'rxjs';
import * as msTeams from "@microsoft/teams-js";
import { IDBPDatabase, OpenDBCallbacks, DBSchema, openDB, deleteDB } from 'idb';
import { tap } from 'rxjs/operators';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  isIdbSupported: boolean;
  isCameraSupported: boolean;
  isGeoLocationSupported: boolean;
  jokes$: Observable<Joke>;
  jokes: string;
  sharesData$: Observable<Share>;
  identity: msTeams.Context;
  db: IDBPDatabase<MyTestDatabase>;
  savedJokes: MyTestDatabase["jokes"]["value"][];
  filteredJokes: MyTestDatabase["jokes"]["value"][];
  savedPhotos: MyTestDatabase["photos"]["value"][];
  videoSize: {height: number, width: number} = {
    height: 0,
    width: 0
  }
  location: {lat: number, lng: number};
  @ViewChild('canvas', { static: true }) canvas: ElementRef;
  @ViewChild('livecam', { static: true }) liveCam: ElementRef;
  @ViewChild('imgPreview', {static: true}) preview: ElementRef;
  
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

    this.initTeamsApp();
    this.initDb();
    this.initCam();
    this.initGeoLocation();
  }
  initTeamsApp() {
    msTeams.initialize();
    // https://docs.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/create-tab-pages/configuration-page
    
    msTeams.getContext((Context: msTeams.Context) => {
      alert("getcontext call back function");
      this.identity = Context;
      if(Context.channelName) {
        this.setupTeamsChannelTab();
      }
    });
  }

  setupTeamsChannelTab() {
    // https://docs.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/create-tab-pages/configuration-page
    alert("Setup channel tab");
    // Set save button available
    msTeams.settings.setValidityState(true);
    // Invoked when user click 'Save' button on Teams
    msTeams.settings.registerOnSaveHandler((saveEvent) => {
      msTeams.settings.setSettings({
          websiteUrl: "https://10802019diag647.z31.web.core.windows.net/",
          contentUrl: "https://10802019diag647.z31.web.core.windows.net/",
          entityId: "Tab:001",
          suggestedDisplayName: "Oscar PWA Demo"
      });
      // Indicate that the content URL has successfully resolved.
      saveEvent.notifySuccess();
    });
  }

  initGeoLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported!!");
      this.isGeoLocationSupported = false;
      return;
    }
    this.isGeoLocationSupported = true;
    this.getPosition().then( pos => this.location = {lat: pos.lat, lng: pos.lng} );
  }
    
  getPosition(): Promise<any> {

    if(!this.isGeoLocationSupported) {
      alert("Geolocation not supported!!");
      return;
    }

    return new Promise((resolve, reject) => {

      navigator.geolocation.getCurrentPosition(
        resp => {
          resolve({lng: resp.coords.longitude, lat: resp.coords.latitude});
        },
        err => {
          reject(err);
        });
    });
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

  deleteDb() {
    // this.db.clear("jokes");
    // this.db.clear("photos");
    deleteDB("MyTestDatabase");
    window.location.reload();
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
    },
    audio: false
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

  async getPhoto(event) {
    let p = await this.toBase64(event.target.files[0]);
    this.preview.nativeElement.src = p;
    this.preview.nativeElement.hidden = false;
  }

  insertPhoto(): void {

    if(!this.isIdbReady()) {
      return;
    }

    if(!this.preview.nativeElement.src.startsWith("data:image/")) {
      alert("Please take photo before saving it.");
      return;
    }
    const tx = this.db.transaction("photos", "readwrite");
    tx.store.add({
      img: this.preview.nativeElement.src,
      create_time: new Date()
    }).then(() => alert("Saved!"));
  }

  async showPhotos() {

    if(!this.isIdbReady()) {
      return;
    }

    const tx = this.db.transaction("photos", "readonly");
    this.savedPhotos = await tx.store.getAll();
  }

  initCam() {
    // https://www.dev6.com/angular/capturing-camera-images-with-angular/
    if (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { 
      navigator.mediaDevices.getUserMedia(this.mediaConstrains)
        .then(this.attachVideo.bind(this))
        .catch(err => {
          console.log(err);
          if(err.name == "NotAllowedError") {
            alert("Please allow camera.");
            this.isCameraSupported = false;
          }
        });
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

  capture() {
    this.renderer.setProperty(this.canvas.nativeElement, 'width', this.videoSize.width);
    this.renderer.setProperty(this.canvas.nativeElement, 'height', this.videoSize.height);
    this.canvas.nativeElement.getContext('2d').drawImage(this.liveCam.nativeElement, 0, 0);
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

  toBase64 = (file: File) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
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
      img: string;
      create_time: Date;
    };
    indexes: {  };
  }
}
