import { ErrorDialogComponent } from "../components/error-dialog";
import { InputBlockerComponent } from "../components/input-blocker";
import { EliminationTabComponent } from "../components/tab-elimination";
import { Observable } from "./observable";
import { RankingAccess } from "./ranking-access";
import type { ScoreTableWrapper } from "./table-wrapper";

/**
 * The entire state of the app.
 */
export class App
{
    public userId = new Observable<string | null>(null);
    public username = new Observable<string | null>(null);
    public authToken = new Observable<string | null>(null);
    public csrfToken = new Observable<string | null>(null);

    public selectedRankingId = new Observable<string | null>(null);
    public selectedTableId = new Observable<string | null>(null);

    public errorDialog: ErrorDialogComponent = new ErrorDialogComponent();
    public inputBlocker: InputBlockerComponent = new InputBlockerComponent();

    public tabElimination: EliminationTabComponent = new EliminationTabComponent(this);

    public rankingAccess: RankingAccess = new RankingAccess(this);
};