import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import * as api from "./common/api";
import { App } from "./common/app";
import { LoadingScreen } from "./components/loading-screen";
import { RootComponent } from "./components/root";

const loadingScreen = new LoadingScreen(document.getElementById("loading-screen") as HTMLElement);

try {
    const app = new App();
    await api.updateXsrfToken(app);
    loadingScreen.advance(0.15);

    await api.signin(app);
    loadingScreen.advance(0.35);

    document.body.appendChild(app.messageBox.view);

    const rootComponent = new RootComponent(app);
    document.body.appendChild(rootComponent.view);
    loadingScreen.advance(0.5);

    if (app.selectedRankingId.value != null) {
        await app.rankingAccess.preloadRanking(app.selectedRankingId.value);
    }
} finally {
    loadingScreen.finish();
}
