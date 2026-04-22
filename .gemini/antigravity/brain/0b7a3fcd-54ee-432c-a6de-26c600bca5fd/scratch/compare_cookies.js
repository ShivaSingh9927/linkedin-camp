const {PrismaClient} = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

(async()=>{
  const userId = 'b5b984e6-c42c-4669-8578-b281dd028f28';
  const u = await p.user.findUnique({where:{id:userId}});
  
  const dbCookies = JSON.parse(u.linkedinCookie);
  const fileCookies = JSON.parse(fs.readFileSync('/app/testscripts/cookies.json','utf-8'));
  
  console.log('=== COOKIE COUNT ===');
  console.log('DB (extension):', dbCookies.length);
  console.log('File (testscript):', fileCookies.length);
  
  const dbNames = new Set(dbCookies.map(c => c.name));
  const fileNames = new Set(fileCookies.map(c => c.name));
  
  const onlyInFile = [...fileNames].filter(n => !dbNames.has(n));
  const onlyInDB = [...dbNames].filter(n => !fileNames.has(n));
  
  console.log('\n=== COOKIES ONLY IN TESTSCRIPT (missing from extension) ===');
  console.log(onlyInFile.join(', '));
  
  console.log('\n=== COOKIES ONLY IN DB (extension-specific) ===');
  console.log(onlyInDB.join(', '));
  
  for (const name of ['li_at', 'JSESSIONID', 'li_mc', 'li_rm', 'liap']) {
    const dbC = dbCookies.find(c => c.name === name);
    const fileC = fileCookies.find(c => c.name === name);
    console.log('\n' + name + ':');
    console.log('  DB:', dbC ? 'domain=' + dbC.domain + ' val=' + dbC.value?.slice(0,25) + '...' : 'MISSING');
    console.log('  File:', fileC ? 'domain=' + fileC.domain + ' val=' + fileC.value?.slice(0,25) + '...' : 'MISSING');
    if (dbC && fileC) console.log('  Same value?', dbC.value === fileC.value);
  }
  
  console.log('\n=== FORMAT COMPARISON ===');
  console.log('DB keys:', Object.keys(dbCookies[0]).sort().join(', '));
  console.log('File keys:', Object.keys(fileCookies[0]).sort().join(', '));
  
  // Show DB cookie samples
  console.log('\n=== DB SAMPLES ===');
  dbCookies.slice(0,3).forEach(c => {
    console.log(JSON.stringify({name:c.name, domain:c.domain, sameSite:c.sameSite, expires:c.expires, expirationDate:c.expirationDate, secure:c.secure, httpOnly:c.httpOnly, path:c.path}));
  });
  
  console.log('\n=== FILE SAMPLES ===');
  fileCookies.slice(0,3).forEach(c => {
    console.log(JSON.stringify({name:c.name, domain:c.domain, sameSite:c.sameSite, expires:c.expires, expirationDate:c.expirationDate, secure:c.secure, httpOnly:c.httpOnly, path:c.path}));
  });
  
  await p.$disconnect();
})();
