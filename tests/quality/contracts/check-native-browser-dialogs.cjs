const { repositoryRoot } = require("../../../scripts/quality/core/repo-context.cjs");
const { walkFiles } = require("../../../scripts/quality/core/filesystem.cjs");
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = repositoryRoot;
const srcRoot = path.join(root, 'src');
const outPath = process.env.NATIVE_DIALOG_AUDIT_OUTPUT || path.join(root, 'native-dialog-audit.json');
const allowedExt = new Set(['.ts','.tsx','.js','.jsx','.mts','.mjs','.cts','.cjs']);
const excludedDir = new Set(['node_modules','dist','build','coverage','__snapshots__','snapshots','fixtures','__fixtures__','generated']);
const excludedFilePatterns = [/\.test\./i,/\.spec\./i,/\.stories\./i,/\.snap$/i,/fixture/i,/mock/i,/generated/i,/\.d\.ts$/i];

const files = walkFiles(srcRoot, {
  excludeDirectory: (entryName) => excludedDir.has(entryName),
  include: (filePath, entryName) => allowedExt.has(path.extname(filePath)) && !excludedFilePatterns.some((pattern) => pattern.test(entryName)),
});
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
let options = {jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,allowJs:true,skipLibCheck:true};
if(configPath){
 const cfg=ts.readConfigFile(configPath,ts.sys.readFile);
 const parsed=ts.parseJsonConfigFileContent(cfg.config,ts.sys,path.dirname(configPath));
 options={...parsed.options,allowJs:true,checkJs:false,skipLibCheck:true,noEmit:true};
}
const program=ts.createProgram(files,options);
const checker=program.getTypeChecker();
const dialogNames=new Set(['alert','confirm','prompt']);

function rel(sf){return path.relative(root,sf.fileName).replace(/\\/g,'/');}
function lineOf(sf,node){return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;}
function getSymbol(node){let s=checker.getSymbolAtLocation(node); if(s && (s.flags & ts.SymbolFlags.Alias)){try{s=checker.getAliasedSymbol(s)}catch{}} return s;}
function symKey(sym){if(!sym)return null; const d=sym.valueDeclaration||sym.declarations?.[0]; return d?`${d.getSourceFile().fileName}:${d.pos}:${sym.getName()}`:`sym:${sym.getName()}`;}
function isGlobalObj(expr){return ts.isIdentifier(expr)&&['window','globalThis','self'].includes(expr.text);}
function propName(expr){
 if(ts.isPropertyAccessExpression(expr)) return expr.name.text;
 if(ts.isElementAccessExpression(expr)){
  const a=expr.argumentExpression;
  if(ts.isStringLiteralLike(a)) return a.text;
  if(ts.isNoSubstitutionTemplateLiteral(a)) return a.text;
 }
 return null;
}
function isLibDomGlobalIdentifier(id){
 if(!ts.isIdentifier(id)||!dialogNames.has(id.text)) return false;
 const sym=checker.getSymbolAtLocation(id);
 if(!sym) return true; // unresolved global in JS
 const decls=sym.declarations||[];
 return decls.some(d=>/lib\.dom\.d\.ts$/.test(d.getSourceFile().fileName.replace(/\\/g,'/'))) || decls.every(d=>d.getSourceFile().isDeclarationFile);
}

const aliasCache=new Map();
function resolveNativeExpr(expr,seen=new Set()){
 while(ts.isParenthesizedExpression(expr)||ts.isAsExpression(expr)||ts.isTypeAssertionExpression(expr)||ts.isNonNullExpression(expr)) expr=expr.expression;
 if(ts.isIdentifier(expr)){
  if(isLibDomGlobalIdentifier(expr)) return {type:expr.text,form:'direct-global'};
  const sym=getSymbol(expr); const key=symKey(sym);
  if(!sym||!key||seen.has(key)) return null;
  if(aliasCache.has(key)) return aliasCache.get(key);
  seen.add(key);
  const decl=sym.valueDeclaration||sym.declarations?.[0];
  let r=null;
  if(decl){
   if(ts.isVariableDeclaration(decl)&&decl.initializer) r=resolveNativeExpr(decl.initializer,seen);
   else if(ts.isBindingElement(decl)){
    const parent=decl.parent?.parent;
    const init=parent&&ts.isVariableDeclaration(parent)?parent.initializer:null;
    const name=decl.propertyName?(ts.isIdentifier(decl.propertyName)||ts.isStringLiteralLike(decl.propertyName)?decl.propertyName.text:null):(ts.isIdentifier(decl.name)?decl.name.text:null);
    if(init && isGlobalObj(init) && dialogNames.has(name)) r={type:name,form:'destructured-alias'};
   }
  }
  aliasCache.set(key,r); return r;
 }
 if((ts.isPropertyAccessExpression(expr)||ts.isElementAccessExpression(expr)) && isGlobalObj(expr.expression)){
  const n=propName(expr); if(dialogNames.has(n)) return {type:n,form:ts.isElementAccessExpression(expr)?'computed-global':'qualified-global'};
 }
 // window.alert.bind(window)
 if(ts.isCallExpression(expr) && (ts.isPropertyAccessExpression(expr.expression)||ts.isElementAccessExpression(expr.expression)) && propName(expr.expression)==='bind'){
  const base=expr.expression.expression; const r=resolveNativeExpr(base,seen); if(r) return {...r,form:'bound-alias'};
 }
 return null;
}

function functionInfo(node){
 let name='(anonymous)'; let symbol=null;
 if(ts.isFunctionDeclaration(node)&&node.name){name=node.name.text;symbol=getSymbol(node.name)}
 else if(ts.isMethodDeclaration(node)&&node.name){name=node.name.getText();symbol=getSymbol(node.name)}
 else if(ts.isFunctionExpression(node)||ts.isArrowFunction(node)){
  if(node.parent&&ts.isVariableDeclaration(node.parent)&&ts.isIdentifier(node.parent.name)){name=node.parent.name.text;symbol=getSymbol(node.parent.name)}
  else if(node.parent&&ts.isPropertyAssignment(node.parent)){name=node.parent.name.getText();symbol=getSymbol(node.parent.name)}
 }
 return {name,symbol,key:symKey(symbol)};
}
function enclosingFunction(node){
 let p=node.parent;
 while(p){if(ts.isFunctionLike(p)){return functionInfo(p).name} p=p.parent}
 return '(module scope)';
}
function enclosingComponent(node){
 let p=node.parent;
 while(p){
  if(ts.isFunctionLike(p)){const n=functionInfo(p).name;if(/^[A-Z]/.test(n)) return n;}
  if(ts.isClassDeclaration(p)&&p.name) return p.name.text;
  p=p.parent;
 }
 const sf=node.getSourceFile(); return path.basename(sf.fileName,path.extname(sf.fileName));
}
function inferModule(file){
 const r=path.relative(srcRoot,file).replace(/\\/g,'/');
 let m=r.match(/^modules\/([^/]+)/); if(m)return m[1];
 m=r.match(/^workspaces\/([^/]+)/); if(m)return `workspace:${m[1]}`;
 m=r.match(/^components\/([^/]+)/); if(m)return `shared:${m[1]}`;
 return r.split('/')[0]||'root';
}
function inferTrigger(node){
 let p=node.parent;
 while(p){
  if(ts.isJsxAttribute(p)) return `JSX ${p.name.getText()}`;
  if(ts.isCallExpression(p)&&ts.isPropertyAccessExpression(p.expression)){
   const n=p.expression.name.text; if(['then','catch','finally','forEach','map'].includes(n)) return `${n} callback`;
  }
  if(ts.isFunctionLike(p)){
   const n=functionInfo(p).name;
   if(/^handle/i.test(n)) return n.replace(/^handle/,'')+' handler';
   if(/^on[A-Z]/.test(n)) return n+' callback';
   if(/submit/i.test(n)) return 'Form submit';
   if(/delete|remove|cancel|archive|close/i.test(n)) return 'Destructive/business action';
   return n;
  }
  p=p.parent;
 }
 return 'Module initialization or indirect call';
}
function resolveString(expr,depth=0,seen=new Set()){
 if(!expr||depth>5)return {kind:'unresolved',text:'(không thể resolve tĩnh)'};
 while(ts.isParenthesizedExpression(expr)||ts.isAsExpression(expr)||ts.isNonNullExpression(expr))expr=expr.expression;
 if(ts.isStringLiteralLike(expr))return {kind:'static',text:expr.text};
 if(ts.isNoSubstitutionTemplateLiteral(expr))return {kind:'static',text:expr.text};
 if(ts.isTemplateExpression(expr)){
  const parts=[expr.head.text]; let dynamic=false;
  for(const s of expr.templateSpans){const rr=resolveString(s.expression,depth+1,seen); if(rr.kind==='static')parts.push(rr.text);else{parts.push('${…}');dynamic=true}parts.push(s.literal.text)}
  return {kind:dynamic?'dynamic-template':'static',text:parts.join('')};
 }
 if(ts.isBinaryExpression(expr)&&expr.operatorToken.kind===ts.SyntaxKind.PlusToken){
  const l=resolveString(expr.left,depth+1,seen),r=resolveString(expr.right,depth+1,seen);
  if(l.kind==='static'&&r.kind==='static')return {kind:'static',text:l.text+r.text};
  return {kind:'dynamic-expression',text:`${l.text} + ${r.text}`};
 }
 if(ts.isIdentifier(expr)){
  const sym=getSymbol(expr),key=symKey(sym); if(key&&seen.has(key))return {kind:'unresolved',text:expr.text}; if(key)seen.add(key);
  const d=sym&&(sym.valueDeclaration||sym.declarations?.[0]); if(d&&ts.isVariableDeclaration(d)&&d.initializer)return resolveString(d.initializer,depth+1,seen);
  return {kind:'dynamic-identifier',text:expr.text};
 }
 if(ts.isConditionalExpression(expr)){
  const a=resolveString(expr.whenTrue,depth+1,seen), b=resolveString(expr.whenFalse,depth+1,seen);
  return {kind:'localized-conditional',text:`Nhánh 1: ${a.text} | Nhánh 2: ${b.text}`};
 }
 if(ts.isCallExpression(expr)){
  const callee=expr.expression.getText();
  if(/(^|\.)t$|translate|i18n|^tx$/i.test(callee)){
   const a=expr.arguments[0]; const k=a&&ts.isStringLiteralLike(a)?a.text:a?a.getText():'?';
   const fallbacks=expr.arguments.slice(1).map(x=>resolveString(x,depth+1,seen).text).filter(Boolean);
   return {kind:'localization-key',text:fallbacks.length?`Key: ${k} | Fallback: ${fallbacks.join(' | ')}`:`Key: ${k}`};
  }
  return {kind:'dynamic-call',text:expr.getText().slice(0,240)};
 }
 return {kind:'dynamic-expression',text:expr.getText().slice(0,240)};
}

const functionNodes=[]; const primitiveCalls=[]; const callRecords=[];
for(const sf of program.getSourceFiles()){
 if(!sf.fileName.startsWith(srcRoot)||sf.isDeclarationFile)continue;
 function visit(node){
  if(ts.isFunctionLike(node)){
   const fi=functionInfo(node); if(fi.key) functionNodes.push({node,sf,...fi});
  }
  if(ts.isCallExpression(node)){
   const native=resolveNativeExpr(node.expression);
   if(native){
    const msg=resolveString(node.arguments[0]);
    primitiveCalls.push({node,sf,native,msg,owner:enclosingFunction(node),component:enclosingComponent(node)});
   } else {
    const sym=getSymbol(ts.isPropertyAccessExpression(node.expression)?node.expression.name:node.expression);
    callRecords.push({node,sf,sym,key:symKey(sym)});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(sf);
}

// map primitive calls to containing wrapper functions
const directByFunction=new Map();
for(const p of primitiveCalls){
 let n=p.node.parent, ownerKey=null;
 while(n){if(ts.isFunctionLike(n)){ownerKey=functionInfo(n).key;break}n=n.parent}
 if(ownerKey){if(!directByFunction.has(ownerKey))directByFunction.set(ownerKey,[]);directByFunction.get(ownerKey).push(p)}
}
const wrapperKeys=new Set(directByFunction.keys());
let changed=true;
while(changed){changed=false;
 for(const fn of functionNodes){if(wrapperKeys.has(fn.key))continue;
  let found=false;
  function v(n){if(found)return;if(ts.isCallExpression(n)){const sym=getSymbol(ts.isPropertyAccessExpression(n.expression)?n.expression.name:n.expression);if(wrapperKeys.has(symKey(sym)))found=true;} if(n!==fn.node&&ts.isFunctionLike(n))return;ts.forEachChild(n,v)}
  if(fn.node.body)v(fn.node.body);
  if(found){wrapperKeys.add(fn.key);changed=true}
 }
}
const wrapperDefs=functionNodes.filter(f=>wrapperKeys.has(f.key));
const wrapperMeta=new Map();
for(const f of wrapperDefs){
 const direct=directByFunction.get(f.key)||[];
 const types=new Set(direct.map(x=>x.native.type));
 // include nested wrapper targets
 function v(n){if(ts.isCallExpression(n)){const sym=getSymbol(ts.isPropertyAccessExpression(n.expression)?n.expression.name:n.expression);const k=symKey(sym);if(k&&wrapperMeta.has(k)) for(const t of wrapperMeta.get(k).types)types.add(t)} if(n!==f.node&&ts.isFunctionLike(n))return;ts.forEachChild(n,v)}
 if(f.node.body)v(f.node.body);
 wrapperMeta.set(f.key,{name:f.name,types:[...types],direct});
}

const findings=[]; let id=1;
function recommendation(type,msg,trigger){
 if(type==='confirm')return 'Thay bằng Confirmation Dialog hoặc Business Rule Dialog có tiêu đề, mô tả hậu quả và nhãn hành động rõ ràng.';
 if(type==='prompt')return 'Thay bằng Modal/Form có label, helper text, validation và hai hành động rõ ràng; không dùng prompt chặn trình duyệt.';
 if(/submit|validation|input|form/i.test(trigger)||/required|invalid|nhập|chọn/i.test(msg))return 'Dùng inline validation tại trường liên quan; dùng error banner nếu lỗi ảnh hưởng toàn form.';
 if(/success|đã |thành công|saved|created|updated/i.test(msg))return 'Dùng Toast không chặn, nêu rõ đối tượng và kết quả.';
 return 'Dùng Toast cho thông báo không chặn hoặc Error Banner cho lỗi cấp trang/form.';
}
for(const p of primitiveCalls){
 const sf=p.sf; const file=rel(sf); const trig=inferTrigger(p.node); const msg=p.msg.text;
 findings.push({
  id:`ND-${String(id++).padStart(4,'0')}`,dialogType:p.native.type,callKind:'direct',invocationForm:p.native.form,
  file,line:lineOf(sf,p.node),component:p.component,function:p.owner,module:inferModule(sf.fileName),message:msg,messageResolution:p.msg.kind,
  trigger:trig,impact:p.native.type==='confirm'||p.native.type==='prompt'?'High — blocking browser UI and inconsistent enterprise interaction':'Medium — blocking browser UI and inaccessible/non-brand feedback',
  recommendation:recommendation(p.native.type,msg,trig),sourceSnippet:p.node.getText(sf).slice(0,500)
 });
}
for(const c of callRecords){
 if(!c.key||!wrapperKeys.has(c.key))continue;
 const meta=wrapperMeta.get(c.key)||{name:'wrapper',types:[],direct:[]};
 const type=meta.types.length===1?meta.types[0]:(meta.types.join('+')||'unknown');
 const sf=c.sf; const trig=inferTrigger(c.node);
 let msg=''; let resolution='wrapper-inherited';
 if(c.node.arguments.length){const r=resolveString(c.node.arguments[0]);msg=r.text;resolution=r.kind==='static'?'wrapper-argument-static':`wrapper-argument-${r.kind}`}
 else if(meta.direct.length===1){msg=meta.direct[0].msg.text;resolution=`wrapper-native-${meta.direct[0].msg.kind}`}
 else msg=`Thông qua wrapper ${meta.name}`;
 findings.push({
  id:`ND-${String(id++).padStart(4,'0')}`,dialogType:type,callKind:'wrapper',invocationForm:`wrapper:${meta.name}`,
  file:rel(sf),line:lineOf(sf,c.node),component:enclosingComponent(c.node),function:enclosingFunction(c.node),module:inferModule(sf.fileName),message:msg,messageResolution:resolution,
  trigger:trig,impact:type.includes('confirm')||type.includes('prompt')?'High — wrapper vẫn kích hoạt native blocking dialog':'Medium — wrapper che giấu native blocking dialog và làm khó chuẩn hóa UI',
  recommendation:recommendation(type,msg,trig),sourceSnippet:c.node.getText(sf).slice(0,500)
 });
}

function normMsg(s){return s.toLowerCase().replace(/\$\{…\}/g,'{dynamic}').replace(/\s+/g,' ').replace(/[.!?]+$/,'').trim()}
const groups=new Map();
for(const f of findings){const k=normMsg(f.message);if(!k||k.startsWith('(không'))continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(f.id)}
const duplicates=[...groups.entries()].filter(([,ids])=>ids.length>1).map(([message,ids])=>({message,count:ids.length,findingIds:ids})).sort((a,b)=>b.count-a.count);

// lightweight near duplicates using token Jaccard >= .72, only unique normalized messages
const unique=[...groups.keys()]; const near=[];
function tok(s){return new Set(s.replace(/[^\p{L}\p{N}{}]+/gu,' ').split(' ').filter(x=>x.length>2))}
for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
 const a=tok(unique[i]),b=tok(unique[j]); if(!a.size||!b.size)continue; let inter=0;for(const x of a)if(b.has(x))inter++; const score=inter/(a.size+b.size-inter);
 if(score>=0.72&&unique[i]!==unique[j])near.push({messageA:unique[i],messageB:unique[j],similarity:+score.toFixed(2),countA:groups.get(unique[i]).length,countB:groups.get(unique[j]).length});
}

const wrappers=wrapperDefs.map(w=>{
 const m=wrapperMeta.get(w.key); return {name:w.name,file:rel(w.sf),line:lineOf(w.sf,w.node),dialogTypes:m.types.join('+')||'indirect',directNativeCalls:(directByFunction.get(w.key)||[]).length};
});

// Trace wrapper references used as JSX/event handlers or explicit calls.
const wrapperConsumers=[]; const consumerSeen=new Set();
for(const sf of program.getSourceFiles()){
 if(!sf.fileName.startsWith(srcRoot)||sf.isDeclarationFile)continue;
 function v(node){
  if(ts.isIdentifier(node)){
   const k=symKey(getSymbol(node));
   if(k&&wrapperKeys.has(k)){
    const d=getSymbol(node)?.valueDeclaration;
    if(d && node===d.name){} else {
      let kind=null, trigger='';
      if(ts.isCallExpression(node.parent)&&node.parent.expression===node){kind='explicit-call';trigger=inferTrigger(node.parent)}
      else if(ts.isJsxExpression(node.parent)&&ts.isJsxAttribute(node.parent.parent)){kind='jsx-handler-reference';trigger=`JSX ${node.parent.parent.name.getText()}`}
      else if(ts.isPropertyAssignment(node.parent)&&node.parent.initializer===node){kind='callback-reference';trigger=node.parent.name.getText()}
      if(kind){const key=`${sf.fileName}:${node.pos}:${kind}`;if(!consumerSeen.has(key)){consumerSeen.add(key);const meta=wrapperMeta.get(k);wrapperConsumers.push({wrapper:meta?.name||node.text,file:rel(sf),line:lineOf(sf,node),kind,trigger,component:enclosingComponent(node)});}}
    }
   }
  }
  ts.forEachChild(node,v);
 }
 v(sf);
}
const directTypeCounts=Object.fromEntries(['alert','confirm','prompt'].map(t=>[t,primitiveCalls.filter(f=>f.native.type===t).length]));
const summary={
 scannedFiles:files.length,
 nativePrimitiveCallSites:primitiveCalls.length,
 wrapperInvocationCallSites:findings.filter(f=>f.callKind==='wrapper').length,
 totalEffectiveCallSites:findings.length,
 byDialogType:directTypeCounts,
 directCallSites:findings.filter(f=>f.callKind==='direct').length,
 wrapperCallSites:findings.filter(f=>f.callKind==='wrapper').length,
 wrappers:wrappers.length,
 uniqueMessages:new Set(findings.map(f=>normMsg(f.message)).filter(Boolean)).size,
 affectedModules:new Set(findings.map(f=>f.module)).size,
 affectedFiles:new Set(findings.map(f=>f.file)).size,
 affectedScreensOrFlows:new Set(findings.map(f=>`${f.file}::${f.component}`)).size,
};
fs.writeFileSync(outPath,JSON.stringify({summary,findings,wrappers,wrapperConsumers,duplicates,nearDuplicates:near,scan:{root:'src/',excluded:['node_modules','dist','build','coverage','generated','snapshots','test/spec/stories/fixtures'],method:'TypeScript Compiler API AST + symbol resolution + alias/destructuring/computed-property analysis + transitive wrapper call graph'},},null,2));
console.log(JSON.stringify(summary,null,2));
console.log('wrappers',wrappers);
console.log('output',outPath);

if (summary.nativePrimitiveCallSites !== 0 || summary.wrapperInvocationCallSites !== 0 || summary.wrappers !== 0) {
  console.error(`Native browser dialog gate failed: ${summary.nativePrimitiveCallSites} primitive calls, ${summary.wrapperInvocationCallSites} wrapper calls, ${summary.wrappers} wrappers.`);
  process.exit(1);
}
console.log('Native browser dialog gate passed: 0 production call sites.');
