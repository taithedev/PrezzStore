export function safeNext(value:string|null|undefined,fallback="/account"):string{
 if(!value||!value.startsWith("/")||value.startsWith("//")||/[\\\\\u0000-\u0020]/.test(value))return fallback;
 try{
  const url=new URL(value,"https://prezzstore.invalid");
  if(url.origin!=="https://prezzstore.invalid")return fallback;
  return url.pathname+url.search+url.hash;
 }catch{return fallback;}
}
