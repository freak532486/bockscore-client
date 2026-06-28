import { App } from "./common/app";
import { LoginComponent } from "./components/login.component";
import * as api from "./common/api"
import { RankingSelector } from "./components/ranking-selector.component";
import { ScoreTableComponent } from "./components/score-table.component";
import { RootComponent } from "./components/root.component";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"

const app = new App();
await api.updateXsrfToken(app);
await api.signin(app);

const rootComponent = new RootComponent(app);
document.body.appendChild(rootComponent.view);

/*

const login = new LoginComponent(app);
document.body.appendChild(login.view);

const rankingSelector = new RankingSelector(app);
document.body.appendChild(rankingSelector.view);


let tableView: ScoreTableComponent | undefined = undefined;
app.selectedTableId.subscribe(() => {
    if (tableView !== undefined) {
        tableView.view.remove();
    }

    if (app.selectedRankingId.value == null || app.selectedTableId.value == null) {
        return;
    }

    tableView = new ScoreTableComponent(app, app.selectedRankingId.value, app.selectedTableId.value);
    document.body.appendChild(tableView.view);
});

*/