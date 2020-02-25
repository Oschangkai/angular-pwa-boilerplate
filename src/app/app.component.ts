import { Share } from './models/share';
import { Joke } from './models/joke';
import { Component, OnInit } from '@angular/core';
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

  jokes$: Observable<Joke>;
  jokes: string;
  sharesData$: Observable<Share>;
  identity: msTeams.Context;
  db: IDBPDatabase<MyTestDatabase>;
  savedJokes: MyTestDatabase["jokes"]["value"][];
  filteredJokes: MyTestDatabase["jokes"]["value"][];
  
  constructor(private dataService: DataService) {}

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
      return;
    }
    this.db = await openDB<MyTestDatabase>("MyTestDatabase", 2, this.idbOptions);
  }

  idbOptions: OpenDBCallbacks<MyTestDatabase> = {

    upgrade(db, oldVer, newVer, tx) {
      console.log(`old version is ${oldVer}, current version is ${newVer}`);
      const store = db.createObjectStore("jokes", { autoIncrement: true });
      store.createIndex("idx_time", "create_time");
    }
  }

  async insertJoke() {

    if(this.db === undefined) {
      alert("IndexedDB not initialized!!");
      return;
    }
    const tx = this.db.transaction("jokes", "readwrite");
    tx.store.add({
      quote: this.jokes,
      create_time: new Date()
    }).then(() => alert("Saved!"));
  }

  async showAllJokes() {
    const tx = this.db.transaction("jokes", "readonly");
    this.savedJokes = await tx.store.getAll();
    this.filteredJokes = undefined;
  }

  async showJoke(days: number) {
    await this.showAllJokes();
    this.filteredJokes = this.savedJokes.filter(el => {
      let date = ( d => new Date(d.setDate(d.getDate()-days)) )(new Date);
      return el.create_time.getDate() == date.getDate();
    });
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
}
