"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function PwaRegister(){
  const [installEvent,setInstallEvent]=useState<InstallPrompt|null>(null); const [showHelp,setShowHelp]=useState(true);
  useEffect(()=>{
    if("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(()=>undefined);
    const onInstall=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPrompt)};
    const onInstalled=()=>{setInstallEvent(null);setShowHelp(false)};
    window.addEventListener("beforeinstallprompt",onInstall);window.addEventListener("appinstalled",onInstalled);
    return()=>{window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("appinstalled",onInstalled)};
  },[]);
  if(!installEvent&&!showHelp)return null;
  return <aside className="pwa-install-banner" aria-label="Install Everwell"><span><b>Take Everwell with you</b><small>{showHelp?"Use your browser’s Install app menu. On iPhone, tap Share, then Add to Home Screen.":"Install the app for a full-screen mobile experience."}</small></span>{installEvent?<button onClick={async()=>{await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==="accepted"){setInstallEvent(null);setShowHelp(false)}}}><Download size={15}/> Install</button>:null}<button className="pwa-close" aria-label="Dismiss install help" onClick={()=>{setShowHelp(false);setInstallEvent(null)}}><X size={15}/></button></aside>
}
