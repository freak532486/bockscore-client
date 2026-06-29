import { ErrorDialogComponent } from "../components/error-dialog.component";
import { InputBlockerComponent } from "../components/input-blocker";
import { Observable } from "./observable";

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
};