const {PrismaClient} = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

(async()=>{
  const userId = 'b5b984e6-c42c-4669-8578-b281dd028f28';
  
  // Read working session files from testscripts
  const cookies = JSON.parse(fs.readFileSync('/app/testscripts/cookies.json','utf-8'));
  const fingerprint = JSON.parse(fs.readFileSync('/app/testscripts/fingerprint.json','utf-8'));
  let localStorage = {};
  try { localStorage = JSON.parse(fs.readFileSync('/app/testscripts/localStorage.json','utf-8')); } catch(e) {}
  
  // Update DB
  await p.user.update({
    where: { id: userId },
    data: {
      linkedinCookie: JSON.stringify(cookies),
      linkedinFingerprint: JSON.stringify(fingerprint),
      linkedinLocalStorage: JSON.stringify(localStorage),
      linkedinActiveInBrowser: true,
      lastBrowserActivityAt: new Date()
    }
  });
  
  // Also copy to user session directory
  const sessionDir = '/app/sessions/' + userId;
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(sessionDir + '/cookies.json', JSON.stringify(cookies, null, 2));
  fs.writeFileSync(sessionDir + '/fingerprint.json', JSON.stringify(fingerprint, null, 2));
  fs.writeFileSync(sessionDir + '/localStorage.json', JSON.stringify(localStorage, null, 2));
  
  console.log('Synced', cookies.length, 'working cookies to DB and session files');
  
  // Verify
  const verify = await p.user.findUnique({ where: { id: userId } });
  const verCookies = JSON.parse(verify.linkedinCookie);
  console.log('Verified DB has', verCookies.length, 'cookies');
  console.log('li_at:', verCookies.find(c => c.name === 'li_at')?.value?.slice(0,30));
  
  await p.$disconnect();
})();
