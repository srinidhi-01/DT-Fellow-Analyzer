// backend/scoreMap.js
const SCORE_MAP = {
  1:  { label: "Not Interested",             band: "Need Attention" },
  2:  { label: "Lacks Discipline",            band: "Need Attention" },
  3:  { label: "Motivated but Directionless", band: "Need Attention" },
  4:  { label: "Careless and Inconsistent",   band: "Productivity"   },
  5:  { label: "Consistent Performer",        band: "Productivity"   },
  6:  { label: "Reliable and Productive",     band: "Productivity"   },
  7:  { label: "Problem Identifier",          band: "Performance"    },
  8:  { label: "Problem Solver",              band: "Performance"    },
  9:  { label: "Innovative and Experimental", band: "Performance"    },
  10: { label: "Exceptional Performer",       band: "Performance"    },
};

function enforceScoreMap(analysis) {
  if (!analysis || !analysis.score) return analysis;

  // parseInt handles cases where model returns "6" as string instead of 6
  const value = parseInt(analysis.score.value, 10);
  const mapping = SCORE_MAP[value];
  if (!mapping) return analysis;

  analysis.score.label = mapping.label;
  analysis.score.band  = mapping.band;

  return analysis;
}

module.exports = { enforceScoreMap };