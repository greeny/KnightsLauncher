import {bootstrapApplication} from "@angular/platform-browser";
import {AppComponent} from "@src/app/AppComponent";
import {appConfig} from "@src/app/AppConfig";

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
