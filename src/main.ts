import { App } from "./common/app";
import * as api from "./common/api"
import { RootComponent } from "./components/root.component";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"

const app = new App();
await api.updateXsrfToken(app);
await api.signin(app);

const rootComponent = new RootComponent(app);
document.body.appendChild(rootComponent.view);