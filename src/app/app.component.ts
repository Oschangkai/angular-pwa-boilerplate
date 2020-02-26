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
  jokes$: Observable<Joke>;
  jokes: string;
  sharesData$: Observable<Share>;
  identity: msTeams.Context;
  db: IDBPDatabase<MyTestDatabase>;
  savedJokes: MyTestDatabase["jokes"]["value"][];
  filteredJokes: MyTestDatabase["jokes"]["value"][];
  savedPhotos: MyTestDatabase["photos"]["value"][];
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

    msTeams.initialize();
    msTeams.getContext((Context: msTeams.Context) => {
      alert("getcontext call back function");
      this.identity = Context;
    });

    this.initDb();
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
