export function refName(ref){return typeof ref==='string'?ref.split('/').at(-1):undefined;}
export function resolveSchema(spec,schema){return schema?.$ref?spec.components.schemas[refName(schema.$ref)]:schema;}
export function validateSchema(spec,schemaOrRef,value,where='$',stack=new Set()){
  const schemas=spec.components.schemas; const issues=[];
  function walk(schema,current,at){
    if(!schema){issues.push(`${at}: missing schema`);return;}
    if(schema.$ref){const name=refName(schema.$ref);if(stack.has(name))return;stack.add(name);walk(schemas[name],current,at);stack.delete(name);return;}
    if(schema.allOf) for(const item of schema.allOf) walk(item,current,at);
    if(schema.oneOf){const matches=schema.oneOf.filter(item=>validateSchema(spec,item,current,at,new Set(stack)).length===0).length;if(matches!==1)issues.push(`${at}: oneOf matched ${matches}`);}
    if(schema.anyOf&&!schema.anyOf.some(item=>validateSchema(spec,item,current,at,new Set(stack)).length===0))issues.push(`${at}: anyOf failed`);
    if(schema.const!==undefined&&current!==schema.const)issues.push(`${at}: const mismatch`);
    if(schema.enum&&!schema.enum.includes(current))issues.push(`${at}: enum mismatch`);
    const types=Array.isArray(schema.type)?schema.type:schema.type?[schema.type]:[];
    if(types.length&&!types.some(t=>matchesType(current,t))){issues.push(`${at}: expected ${types.join('|')}`);return;}
    const effective=types.find(t=>t!=='null')??(schema.properties||schema.additionalProperties!==undefined?'object':schema.items?'array':undefined);
    if(effective==='object'&&current&&typeof current==='object'&&!Array.isArray(current)){
      for(const key of schema.required??[]) if(!(key in current)||current[key]===undefined)issues.push(`${at}.${key}: required`);
      const props=schema.properties??{};
      for(const [key,item] of Object.entries(current)){
        if(props[key])walk(props[key],item,`${at}.${key}`);
        else if(schema.additionalProperties===false)issues.push(`${at}.${key}: additional property`);
        else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')walk(schema.additionalProperties,item,`${at}.${key}`);
      }
    }
    if(effective==='array'&&Array.isArray(current)){if(schema.minItems!==undefined&&current.length<schema.minItems)issues.push(`${at}: minItems`);current.forEach((item,i)=>schema.items&&walk(schema.items,item,`${at}[${i}]`));}
    if(effective==='string'&&typeof current==='string'){
      if(schema.minLength!==undefined&&current.length<schema.minLength)issues.push(`${at}: minLength`);
      if(schema.maxLength!==undefined&&current.length>schema.maxLength)issues.push(`${at}: maxLength`);
      if(schema.pattern&&!new RegExp(schema.pattern,'u').test(current))issues.push(`${at}: pattern`);
      if(schema.format==='date-time'&&(!current.endsWith('Z')||Number.isNaN(Date.parse(current))))issues.push(`${at}: date-time`);
      if(schema.format==='date'&&!/^\d{4}-\d{2}-\d{2}$/u.test(current))issues.push(`${at}: date`);
      if(schema.format==='email'&&!current.includes('@'))issues.push(`${at}: email`);
      if(schema.format==='uri'&&!/^https?:\/\//u.test(current))issues.push(`${at}: uri`);
    }
    if((effective==='integer'||effective==='number')&&typeof current==='number'){
      if(effective==='integer'&&!Number.isInteger(current))issues.push(`${at}: integer`);
      if(schema.minimum!==undefined&&current<schema.minimum)issues.push(`${at}: minimum`);
      if(schema.maximum!==undefined&&current>schema.maximum)issues.push(`${at}: maximum`);
    }
  }
  walk(schemaOrRef,value,where); return issues;
}
function matchesType(v,t){if(t==='null')return v===null;if(t==='object')return Boolean(v&&typeof v==='object'&&!Array.isArray(v));if(t==='array')return Array.isArray(v);if(t==='string')return typeof v==='string';if(t==='number')return typeof v==='number'&&Number.isFinite(v);if(t==='integer')return typeof v==='number'&&Number.isInteger(v);if(t==='boolean')return typeof v==='boolean';return true;}
export function sampleFromSchema(spec,schemaOrRef,nameHint='value',stack=new Set()){
  let schema=schemaOrRef;
  if(schema?.$ref){const name=refName(schema.$ref);if(stack.has(name))return undefined;stack.add(name);const value=sampleFromSchema(spec,spec.components.schemas[name],name,stack);stack.delete(name);return value;}
  if(!schema)return null;
  if(schema.example!==undefined)return structuredClone(schema.example);
  if(schema.const!==undefined)return schema.const;
  if(schema.enum)return schema.enum[0];
  if(schema.allOf){const out={};for(const item of schema.allOf){const value=sampleFromSchema(spec,item,nameHint,stack);if(value&&typeof value==='object'&&!Array.isArray(value))Object.assign(out,value);}return out;}
  if(schema.oneOf)return sampleFromSchema(spec,schema.oneOf[0],nameHint,stack);
  if(schema.anyOf)return sampleFromSchema(spec,schema.anyOf.find(x=>x.type!=='null')??schema.anyOf[0],nameHint,stack);
  const type=Array.isArray(schema.type)?schema.type.find(t=>t!=='null'):schema.type;
  if(type==='object'||schema.properties){const out={};for(const key of schema.required??[])out[key]=sampleFromSchema(spec,schema.properties?.[key],key,stack);return out;}
  if(type==='array'||schema.items)return [sampleFromSchema(spec,schema.items,nameHint.replace(/s$/u,''),stack)];
  if(type==='integer')return Math.max(schema.minimum??1,1);
  if(type==='number')return Math.max(schema.minimum??1,1);
  if(type==='boolean')return false;
  if(type==='string'||!type){
    if(schema.format==='date-time')return '2026-07-25T00:00:00.000Z';
    if(schema.format==='date')return '2026-07-25';
    if(schema.format==='email')return 'provider@example.test';
    if(schema.format==='uri')return 'https://provider.example.test/resource';
    if(schema.pattern==='^[0-9]{6}$'||schema.pattern==='^\\d{6}$')return '123456';
    if(schema.pattern==='^[A-Z]{3}$')return 'VND';
    if(schema.pattern?.includes('0|[1-9][0-9]'))return '10.00';
    if(schema.pattern==='^[A-Z]{2}$')return 'VN';
    if(/amount/i.test(nameHint))return '1000.00';
    if(/exchangeRate|rate$/i.test(nameHint))return '1.000000';
    if(/countryCode/i.test(nameHint))return 'VN';
    if(/currency/i.test(nameHint))return 'VND';
    if(/correlation/i.test(nameHint))return 'correlation-reference-host';
    if(/command/i.test(nameHint))return 'command-reference-host';
    if(/version/i.test(nameHint))return '1';
    if(/phone/i.test(nameHint))return '0900000000';
    if(/code/i.test(nameHint))return 'REFERENCE_CODE';
    if(/id$/i.test(nameHint)||/^id$/i.test(nameHint))return `fixture-${nameHint.replace(/Id$/u,'').toLowerCase()||'id'}`;
    const min=Math.max(schema.minLength??1,1);const max=Math.max(schema.maxLength??16,min);return 'x'.repeat(Math.min(Math.max(min,1),max,16));
  }
  return null;
}
export function mergeSubset(target,subset){for(const [k,v] of Object.entries(subset??{})){if(v&&typeof v==='object'&&!Array.isArray(v)){target[k]??={};mergeSubset(target[k],v);}else target[k]=v;}return target;}
export function setFirstProperty(value,key,newValue){if(!value||typeof value!=='object')return false;if(Object.prototype.hasOwnProperty.call(value,key)){value[key]=newValue;return true;}for(const child of Object.values(value)){if(setFirstProperty(child,key,newValue))return true;}return false;}
