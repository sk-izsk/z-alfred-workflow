import {execFile} from "node:child_process";
export type WindowItem={id:string;pid:number;bundle:string;app:string;title:string;index:number;position:number[];size:number[];minimized:boolean;onscreen:boolean;appPath:string};
export type Scope="all"|"active"|"desktop";
const script=`ObjC.import('Foundation');ObjC.import('AppKit');ObjC.import('CoreGraphics');
function run(argv){
 var input=JSON.parse(ObjC.unwrap($.NSString.alloc.initWithDataEncoding($.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile,$.NSUTF8StringEncoding)));
 var se=Application('System Events');
 try {
  var processes=se.applicationProcesses.whose({backgroundOnly:false})();
  if(input.command==='list'){
   var visible=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1|16,0))), items=[],front='';
   try{front=ObjC.unwrap($.NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier)||'';}catch(e){}
   for(var i=0;i<processes.length;i++){
    var p=processes[i],pid=p.unixId(),bundle=p.bundleIdentifier()||'',app=p.name();
    if(bundle==='com.runningwithcrayons.Alfred'||bundle==='com.runningwithcrayons.Alfred-Preferences')continue;
    if(input.scope==='active'&&bundle!==front)continue;
    var windows;try{windows=p.windows();}catch(e){continue;}
    var appPath='';try{appPath=ObjC.unwrap($.NSRunningApplication.runningApplicationWithProcessIdentifier(pid).bundleURL.path)||'';}catch(e){}
    for(var j=0;j<windows.length&&items.length<1000;j++){
     try{
      var w=windows[j],title=w.name()||'',position=w.position(),size=w.size(),minimized=false;
      try{minimized=Boolean(w.attributes.byName('AXMinimized').value());}catch(e){}
      if(size[0]<100||size[1]<60||(!input.minimized&&minimized))continue;
      var onscreen=false;
      for(var k=0;k<visible.length;k++){
       var cg=visible[k],b=cg.kCGWindowBounds;
       if(cg.kCGWindowOwnerPID===pid&&cg.kCGWindowLayer===0&&Math.abs(b.X-position[0])<5&&Math.abs(b.Y-position[1])<5&&Math.abs(b.Width-size[0])<5&&Math.abs(b.Height-size[1])<5){onscreen=true;break;}
      }
      if(input.scope==='desktop'&&(!onscreen||minimized))continue;
      items.push({id:String(pid)+':'+String(j),pid:pid,bundle:bundle,app:app,title:title,index:j,position:position,size:size,minimized:minimized,onscreen:onscreen,appPath:appPath});
     }catch(e){}
    }
   }
   return JSON.stringify({items:items,front:front});
  }
  var t=input.target,p=null;
  for(var i=0;i<processes.length;i++){if(processes[i].unixId()===t.pid&&processes[i].bundleIdentifier()===t.bundle){p=processes[i];break;}}
  if(!p)throw new Error('Application has closed. Refresh the window list.');
  var windows=p.windows(),w=windows[t.index];
  if(!w||w.name()!==t.title)throw new Error('Window changed. Refresh before acting.');
  if(input.command==='quit'){
   var app=$.NSRunningApplication.runningApplicationWithProcessIdentifier(t.pid);
   if(!app.terminate)throw new Error('The app declined the quit request.');
  }else if(input.command==='close'){
   var pos=w.position(),size=w.size();
   if(Math.abs(pos[0]-t.position[0])>5||Math.abs(pos[1]-t.position[1])>5||Math.abs(size[0]-t.size[0])>5||Math.abs(size[1]-t.size[1])>5)throw new Error('Window moved or changed. Refresh before closing it.');
   w.attributes.byName('AXCloseButton').value().click();
  }else if(input.command==='raise'){
   try{w.attributes.byName('AXMinimized').value=false;}catch(e){}
   p.frontmost=true;
   var raised=false;
   try{
    var bars=p.menuBars(),menus=bars.length?bars[0].menuBarItems():[];
    for(var m=0;m<menus.length;m++){
     if(['Window','Windows','Fenêtre','Fenster','Ventana','窗口','ウインドウ'].indexOf(menus[m].name())<0)continue;
     var menu=menus[m].menus()[0].menuItems(),matches=[];
     for(var n=0;n<menu.length;n++){if(menu[n].name()===t.title)matches.push(menu[n]);}
     if(matches.length===1){matches[0].click();raised=true;break;}
    }
   }catch(e){}
   if(!raised)w.actions.byName('AXRaise').perform();
  }else throw new Error('Unsupported window action.');
  return JSON.stringify({ok:true});
 }catch(e){return JSON.stringify({error:String(e.message||e)});}
}`;
const run=(input:Record<string,unknown>):Promise<any>=>new Promise((resolve,reject)=>{
 const child=execFile("/usr/bin/osascript",["-l","JavaScript","-e",script],{timeout:12000,maxBuffer:3000000},(error,stdout)=>{
  if(error){reject(new Error("Window access failed. Grant Alfred Accessibility and Automation access to System Events.",{cause:error}));return;}
  try{const value=JSON.parse(stdout);if(value.error)throw new Error(value.error);resolve(value);}catch(error){reject(error);}
 });child.stdin?.on("error",()=>{});child.stdin?.end(JSON.stringify(input));
});
export const listWindows=async(scope:Scope,minimized=true):Promise<WindowItem[]>=>{
 const data=await run({command:"list",scope,minimized});
 if(!Array.isArray(data.items))throw new Error("Unsupported window response.");return data.items;
};
export const actOnWindow=async(command:string,target:WindowItem):Promise<void>=>{
 if(!["raise","close","quit"].includes(command))throw new Error("Unsupported window action.");await run({command,target});
};
export const matchesWindow=(w:WindowItem,query:string):boolean=>query.toLowerCase().split(/\s+/).every((word)=>`${w.title} ${w.app}`.toLowerCase().includes(word));
