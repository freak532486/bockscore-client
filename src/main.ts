import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import * as api from "./common/api";
import { App } from "./common/app";
import { RootComponent } from "./components/root";

const app = new App();
await api.updateXsrfToken(app);
await api.signin(app);

const rootComponent = new RootComponent(app);
document.body.appendChild(rootComponent.view);