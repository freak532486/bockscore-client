import { ErrorDialogComponent } from "../components/error-dialog";
import { ImageViewer } from "../components/image-viewer";
import { InputBlockerComponent } from "../components/input-blocker";
import { MessageBox } from "../components/message-box";
import { EliminationTabComponent } from "../components/tab-elimination";
import { Observable } from "./observable";
import { RankingAccess } from "./ranking-access";
import { SSEHandler } from "./sse-handler";

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

    public sseHandler: SSEHandler = new SSEHandler(this);
    public rankingAccess: RankingAccess = new RankingAccess(this);

    public messageBox: MessageBox = new MessageBox();
    public errorDialog: ErrorDialogComponent = new ErrorDialogComponent();
    public inputBlocker: InputBlockerComponent = new InputBlockerComponent();
    public imageViewer: ImageViewer = new ImageViewer();

    public tabElimination: EliminationTabComponent = new EliminationTabComponent(this);
};