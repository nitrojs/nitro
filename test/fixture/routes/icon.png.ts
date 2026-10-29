export default defineEventHandler((event) => {
  setHeader(event, "Content-Type", "image/png");
  return Buffer.from(_base64ToArray(_getLogoBase64()));
});

function _getLogoBase64() {
  return "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAT9JREFUOE+t081KAlEUwPH/nRkn0pmgZWQgFLTpBYqQVkFUmgTRNnqKkFrZop7Blm4KQq02rVqYr1AILaKPZYIzGY46ExdRNMWP6u4ul/O759x7jggli0fgxQGd0ZYD4liEkh+VXwQ3r3Ik4DV3igBVQNXtnYomQB65rQjoALbndE7DAfZvbe5eq11KJmKSeqxwXnBaZ13ASThAyfHYTJd4sztTGQrYWxjjueQybSjsXFs4bcbQwO6NTSZqkn+vcZgvt9IdGthIW8xPqlxGTOK5MumnRs0jATIgNquTWPYTy1oUivXRAYkklvwsTmlEsxapNWPwL8hHlCU0l67CxbrJi+0yYyqkHgZ8409AQkFD4WprAsMniN9/9u+DXoBEVoI+zlYNDnJ9AE0Bn4Cveu9WHtcabV5r643/GKa/jfM3OT68lZwxK8oAAAAASUVORK5CYII=";
}

function _base64ToArray(base64: string) {
  const str = atob(base64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}
