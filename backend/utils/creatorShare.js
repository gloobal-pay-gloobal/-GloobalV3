// src/utils/creatorShare.js
var CREATOR_SHARE_BUCKETS = ["0\u20131%", "1\u20132%", "2\u20133%", "3\u20134%", "4\u20135%", "5\u20136%", "6\u20137%"];
function computeCreatorShareDistribution(myShareRate) {
  const bucketIndex = Math.min(Math.floor(myShareRate), CREATOR_SHARE_BUCKETS.length - 1);
  return CREATOR_SHARE_BUCKETS.map((range, i) => ({ range, pct: i === bucketIndex ? 100 : 0 }));
}

