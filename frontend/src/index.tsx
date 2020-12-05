import * as React from "react";
import { Fragment, useState } from "react";
import * as ReactDOM from "react-dom";
import * as signalR from "@microsoft/signalr";

import "./index.scss";

interface PageProps {
    pushPage : (page : JSX.Element) => void,
    popPage : () => void,
    hub : any
}

const MainMenuPage = (props : PageProps) : JSX.Element => {
    const onCreateRoomClicked = () => {
        props.pushPage(<CreateRoomPage {...props}/>);
    };
    return <div id="menu">
        <div className="spelling">twaddle</div>
        <div className="pronunciation">/ˈtwɒd.əl/<span className="pos">noun</span></div>
        <ol className="defns">
            <li className="clickable" onClick={onCreateRoomClicked}>Create room</li>
        </ol>
    </div>
}

interface RoomPageProps extends PageProps {
    room : any,
    playerName : string
}
const RoomPage = (props : RoomPageProps) => {
    const [realRoom, setRealRoom] = useState(props.room);

    React.useEffect(() => {
        props.hub.on("PlayerJoined", (connId : string, playerName : string) => {
            setRealRoom({
                ...realRoom,
                players: {
                    ...realRoom.players,
                    [connId]: playerName
                }
            });
        });
        props.hub.on("RoundStarted", (word : string) => {
            props.pushPage(<SubmitPage {...props} word={word}/>)
        });
    }, []);

    const start = async () => {
        await props.hub.invoke("StartRound", realRoom.id);
    };

    return <div id="wait_room">
        <div className="spelling"><a href={`/rooms/${props.room.id}/join`}>{props.room.name}</a></div>
        <div className="pronunciation">/{props.playerName}/<span className="pos">pron</span></div>
        <ol>
            {(Object.values(realRoom.players) as string[]).map (
                (playerName : string) => <li key={playerName}>{playerName}</li>
            )}
        </ol>
        <ul className="defns">
            <li className="clickable" onClick={ev => start()}>Start</li>
            <li className="clickable" onClick={props.popPage}>Leave</li>
        </ul>
    </div>
}

interface JoinPageProps extends PageProps {
    roomId : string
}
const JoinRoomPage = (props : JoinPageProps) : JSX.Element => {
    const [playerName, setPlayerName] = useState("");
    const join = async () => {
        const room = await props.hub.invoke("JoinRoom", props.roomId, playerName);
        props.pushPage(<RoomPage {...props} room={room} playerName={playerName}/>);
    };
    return <div>
        <input value={playerName} onChange={ev => setPlayerName(ev.target.value)}></input>
        <button onClick={join}>Join</button>
    </div>
}

const CreateRoomPage = (props : PageProps) : JSX.Element => {
    const [roomName, setRoomName] = useState("");
    const [playerName, setPlayerName] = useState("");

    const createRoom = async () => {
        const room = await props.hub.invoke("CreateRoom", roomName, playerName);
        props.popPage();
        props.pushPage(<RoomPage {...props} room={room} playerName={playerName}/>);
    };

    return <div id="room">
        <input className="spelling" placeholder="Room name"
            value={roomName} onChange={ev => setRoomName(ev.target.value)}/>
        <div className="pronunciation">
            /<input placeholder="player name"
                value={playerName} onChange={ev => setPlayerName(ev.target.value)}></input>
                /<span className="pos">pron</span>
        </div>
        <ol className="defns">
            <li className="clickable" onClick={createRoom}>Create</li>
            <li className="clickable" onClick={() => props.popPage()}>Back</li>
        </ol>
    </div>
}

interface ChooseAnswerPageProps extends RoundStartedPageProps {
    options : string[]
}
const ChooseAnswerPage = (props : ChooseAnswerPageProps) => {
    React.useEffect(() => {
        props.hub.on("SubmitChoiceEnded", (connId : string, choices : any) => {
            
        });
    }, []);

    const barRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (barRef.current !== null) {
            barRef.current.animate([
                { width: "100%" },
                { width: "0%"}
            ], {
                duration: 30*1000
            }).onfinish = () => {
                if (barRef.current !== null) {
                    barRef.current.style.width = "0%";
                }
            }
        }
    }, []);

    const [chosenIx, setChosenIx] = useState<number | null>(null);

    const chooseAnswer = (ix : number) => {
        setChosenIx(ix);
        props.hub.invoke("SubmitChoice", props.room.id, ix);
    };
    return <div id="game">
        <div className="timer">
            <div className="timer-bar" ref={barRef}/>
        </div>
        <div className="spelling">{props.word}</div>
        <div className="pronunciation">/ˈtwɒd.əl/<span className="pos">noun</span></div>
        <ol className="defns">
            {props.options.map((defn, ix) => {
                const className = ix === chosenIx ? "selected clickable" : "clickable";
                return <li key={ix} className={className} onClick={_ => chooseAnswer(ix)}>{defn}</li>;
            })}
        </ol>
    </div>
}

interface RoundEndedPageProps extends RoundStartedPageProps {
    chosen : Map<string, string>
}
const RoundEndedPage = (props : RoundEndedPageProps) => {
    return <div id="game">
        <div className="spelling">{props.word}</div>
        <div className="pronunciation">/ˈtwɒd.əl/<span className="pos">noun</span></div>
        <ol className="defns">
        </ol>
    </div>
}


interface RoundStartedPageProps extends RoomPageProps {
    word : string;
}
const SubmitPage = (props : RoundStartedPageProps) : JSX.Element => {
    const barRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        props.hub.on("SubmitDefnEnded", (answers : string[]) => {
            props.pushPage(<ChooseAnswerPage {...props} options={answers}/>);
        });
        
        if (barRef.current !== null) {
            barRef.current.animate([
                { width: "100%" },
                { width: "0%"}
            ], {
                duration: 30*1000
            }).onfinish = () => {
                if (barRef.current !== null) {
                    barRef.current.style.width = "0%";
                }
            }
        }
    }, []);

    const [definition, setDefinition] = useState("");
    const submit = (ev : any) => {
        props.hub.invoke("SubmitDefn", props.room.id, definition);
    };

    return <div id="game">
        <div className="timer">
            <div className="timer-bar" ref={barRef}/>
        </div>
        <div className="spelling">{props.word}</div>
        <div className="pronunciation">/ˈhʌŋ.ɡɹi/<span className="pos">adj</span></div>
        <div id="write-area">
            <textarea className="defn" autoFocus={true} maxLength={140} placeholder="Codswallop goes here"
                value={definition} onChange={ev => setDefinition(ev.target.value)}></textarea>
            <div className="charlimit">({definition.length}/140)</div>
            <button onClick={submit}>Submit</button>
        </div>
    </div>
}

const Twaddle = (props: {root : (p : PageProps) => JSX.Element}) : JSX.Element => {
    const [con, setCon] = useState<any | null>();
    React.useEffect(() => {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/api/gamehub")
            .build();
        setCon(connection);
    }, []);

    const connect = async () => {
        const connected = await con.start().catch((err: string) => window.alert(err));
    };

    const [pages, setPages] = useState([<h1>Loading</h1>]);
    const pushPage = (newPage : JSX.Element) => {
        setPages([...pages, newPage]);
    };
    const popPage = () => {
        setPages(pages.slice(0, pages.length));
    };
    window.onpopstate = () => {
        popPage();
    };
    React.useEffect(() => {
        if (con) {
            connect();
            setPages([props.root({hub: con, pushPage: pushPage, popPage: popPage})]);
        }
    }, [con]);
    return pages[pages.length - 1];
}

const path = window.location.pathname;

var m = path.match(/\/rooms\/([^\/]+)\/join\/?$/);
if (m) {
    const roomId = m[1];
    const page = (p : PageProps) => <JoinRoomPage {...p} roomId={roomId}/>;
    ReactDOM.render (
        <Twaddle root={page}/>,
        document.getElementById("twaddle")
    );
} else {
    ReactDOM.render (
        <Twaddle root={MainMenuPage}/>,
        document.getElementById("twaddle")
    );
}