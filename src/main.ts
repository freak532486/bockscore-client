import { App } from "./common/app";
import { LoginComponent } from "./components/login.component";
import * as api from "./common/api"

const app = new App();
await api.updateXsrfToken(app);
await api.signin(app);

let login = new LoginComponent(app);
document.body.appendChild(login.view);