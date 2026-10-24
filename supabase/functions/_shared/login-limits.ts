export async function allowHubLogin({clientKey,cryptoPort,repository}:any):Promise<boolean>{
 try{return await repository.consumeLoginAttempt(await cryptoPort.sha256('hub-login:'+clientKey))===true;}
 catch{return false;} // No credential guessing while the limiter is unavailable.
}
