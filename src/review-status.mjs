export function reviewStatus(review,{importedMaterial,guide,daily}){
 if(!review)return 'missing';if(!review.materialHash)return 'unversioned';
 const version=review.materialHash;const current=version.startsWith('guide:')?(guide?.hash?'guide:'+guide.hash:null):version.startsWith('daily:')?(daily?.hash?'daily:'+daily.hash:null):importedMaterial?.hash;
 return current===version?'current':'stale';
}
