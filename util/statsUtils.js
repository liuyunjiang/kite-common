const {RTCStatObject, RTCCodecStats, RTCMediaStreamStats, RTCRTPStreamStats, RTCPeerConnectionStats, RTCTransportStats, RTCIceCandidatePairStats, RTCIceCandidateStats} = require('../RTCstats');

const candidatePairStats = ["bytesSent", "bytesReceived", "currentRoundTripTime", "totalRoundTripTime", "timestamp"];
const inboundStats = ["bytesReceived", "packetsReceived", "packetsLost", "jitter", "timestamp"];
const outboundStats = ["bytesSent", "timestamp"];


function buildClientStatObject(clientStats, selectedStats) {
  let builder = {};
  try {
    let clientStatArray = clientStats['stats'];
    let jsonClientStatArray = [];
    for(let i = 0; i < clientStatArray.length; i++) {
      let jsonStatObjectBuilder = buildSingleStatObject(clientStatArray[i], selectedStats);
      jsonClientStatArray.push(jsonStatObjectBuilder);
    }
    if(selectedStats == null) {
      // add SDP offer stuff
      let sdpBuilder = {};
      let tmpsdpOffer = clientStats["offer"];
      let tmpsdpAnswer = clientStats["answer"];
      let sdpOffer = {};
      let sdpAnswer = {};
      sdpOffer["type"] = tmpsdpOffer["type"];
      sdpOffer["sdp"] = tmpsdpOffer["sdp"];
      sdpAnswer["type"] = tmpsdpAnswer["type"];
      sdpAnswer["sdp"] = tmpsdpAnswer["sdp"];
      sdpBuilder["offer"] = sdpOffer;
      sdpBuilder["answer"] = sdpAnswer;
      builder["sdp"] = sdpBuilder;
    }
    builder['statsArray'] = jsonClientStatArray; 
    return builder;
  } catch (e) {
    console.log(e);
    return {};
  }  
}

function buildSingleStatObject(statArray, selectedStats) {
  let builder = {};
  let stat = {};
  let selectedStatsString = JSON.stringify(selectedStats);
  if (statArray != null) {
    for(var i = 0; i < statArray.length; i++) {
      if (statArray[i] != null) {
        var type = statArray[i].type;
        if(selectedStatsString == "null" || selectedStatsString.length == 0 || selectedStatsString.indexOf(type) != -1) {
          var statObject = null;
          switch(type) {
            case "codec": 
              statObject = new RTCCodecStats(statArray[i]);
              break;
            case "track": 
              statObject = new RTCCodecStats(statArray[i]);
              break;
            case "stream": 
              statObject = new RTCMediaStreamStats(statArray[i]);
              break;
            case "inbound-rtp": 
              statObject = new RTCRTPStreamStats(statArray[i], true);
              break;
            case "outbound-rtp": 
              statObject = new RTCRTPStreamStats(statArray[i], false);
              break;
            case "peer-connection": 
              statObject = new RTCPeerConnectionStats(statArray[i]);
              break;
            case "transport": 
              statObject = new RTCTransportStats(statArray[i]);
              break;
            case "candidate-pair": 
              statObject = new RTCIceCandidatePairStats(statArray[i]);
              break;
            case "remote-candidate":
              statObject = new RTCIceCandidateStats(statArray[i]);
              break;
            case "local-candidate":
              statObject = new RTCIceCandidateStats(statArray[i]);
              break;
            default:
              break;
          }
          if(statObject != null) {
            if(stat[type] === undefined) {
              stat[type] = [];
            }
            stat[type].push(statObject);
          }
        }
      }
    } 
  }
  if(!(stat === undefined)) {
    for(let i = 0; i < Object.keys(stat).length; i++) {
      let idx = Object.keys(stat)[i];
      let tmp = {};
      for(let j = 0; j < stat[idx].length; j++) {
        let jdx = stat[idx][j];
        tmp[jdx.id] = jdx.getJsonBuilder();
      }
      builder[idx] = tmp;
    }
  }
  return builder;
}

function getSuccessfulCandidate(jsonObject) {
  let candObj = jsonObject['candidate-pair'];
  if(candObj == null) {
    return null;
  }
  for(let i = 0; i < Object.keys(candObj).length; i++) {
    let idx = Object.keys(candObj)[i];
    if("succeeded" === candObj[idx].state) {
      return candObj[idx];
    }
  }
  for(let i = 0; i < Object.keys(candObj).length; i++) {
    let idx = Object.keys(candObj)[i];
    if("in-progress" === candObj[idx].state && !("NA" === candObj[idx].currentRoundTripTime)) {
      return candObj[idx];
    }
  }
  return null;
}

function getRTCStats(jsonObject, stats, mediaType) {
  let obj = jsonObject[stats];
  if(obj != null) {
    for(let i = 0; i < Object.keys(obj).length; i++) {
      let idx = Object.keys(obj)[i];
      if(mediaType === obj[idx]['mediaType']) {
        return obj[idx];
      }
    }
  }
  return null;
}

function extractStats(senderStats, receiverStats) {
  let builder = {};
  if(!(senderStats === undefined)) {
    builder['localPC'] = extractJson(senderStats, "out");
  }
  if(receiverStats != undefined) {
    let i = 0;
    for(let j = 0; j < receiverStats.length; j++){
      builder["remotePC[" + i++ + "]"] = extractJson(receiverStats[j], "in");
    }
  }
  return builder;
}

function extractJson(jsonObj, direction) {
  let builder = {};
  let jsonArray = jsonObj['statsArray'];
  let noStats = 0;
  if(jsonObj != undefined) {
    if(jsonArray != undefined) {
      noStats = jsonArray.length;
    }
    for(let i = 0; i < noStats; i++) {
      builder['candidate-pair_' + i] = getStatsJsonBuilder(jsonArray[i], candidatePairStats, "candidate-pair", "");
      if("both" === direction.toLowerCase() || "in" === direction.toLowerCase()) {
        builder['inbound-audio_' + i] = getStatsJsonBuilder(jsonArray[i], inboundStats, "inbound-rtp", "audio");
        builder['inbound-video_' + i] = getStatsJsonBuilder(jsonArray[i], inboundStats, "inbound-rtp", "video");
      }
      if("both" === direction.toLowerCase() || "out" === direction.toLowerCase()) {
        builder['outbound-audio_' + i] = getStatsJsonBuilder(jsonArray[i], outboundStats, "outbound-rtp", "audio");
        builder['outbound-video_' + i] = getStatsJsonBuilder(jsonArray[i], outboundStats, "outbound-rtp", "video");
      }
    }
  } else {
    console.log("statsArray is null");
  }
  let csvBuilder = {};
  csvBuilder['currentRoundTripTime (ms)'] = computeRoundTripTime(builder, noStats, "current");
  csvBuilder['totalRoundTripTime (ms)'] = computeRoundTripTime(builder, noStats, "total")
  csvBuilder['totalBytesReceived (Bytes)'] = totalBytes(builder, noStats, "Received");
  csvBuilder['totalBytesSent (Bytes)'] = totalBytes(builder, noStats, "Sent");
  csvBuilder['avgSentBitrate (bps)'] = computeBitrate(builder, noStats, "Sent", "candidate-pair");
  csvBuilder['avgReceivedBitrate (bps)'] = computeBitrate(builder, noStats, "Received", "candidate-pair");
  if("both" === direction || "in" === direction) {
    csvBuilder['inboundAudioBitrate (bps)'] = computeBitrate(builder, noStats, "in", "audio");
    csvBuilder['inboundVideoBitrate (bps)'] = computeBitrate(builder, noStats, "in", "video");
  }
  if("both" === direction || "out" === direction) {
    csvBuilder['outboundAudioBitrate (bps)'] = computeBitrate(builder, noStats, "out", "audio");
    csvBuilder['outboundVideoBitrate (bps)'] = computeBitrate(builder, noStats, "out", "video");
  }
  if("both" === direction || "in" === direction) {
    csvBuilder['audioJitter (ms)'] = computeAudioJitter(builder, noStats);
    csvBuilder['audioPacketsLoss (%)'] = computePacketsLoss(builder, noStats, "audio");
    csvBuilder['videoPacketsLoss (%)'] = computePacketsLoss(builder, noStats, "video");
  }
  return csvBuilder;
}

function getJsonObjectName(direction, mediaType) {
  if("candidate-pair" === mediaType) {
    return "candidate-pair_";
  }
  return direction + "bound-" + mediaType + "_";
}

function getJsonKey(direction) {
  if("Sent" === direction || "out" === direction) {
    return "bytesSent";
  }
  if("Received" === direction || "in" === direction) {
    return "bytesReceived";
  }
  return null;
}

function computeRoundTripTime(jsonObject, noStats, prefix) {
  let rtt = 0;
  let ct = 0;
  try {
    for(let i = 0; i < noStats; i++) {
      let s = jsonObject["candidate-pair_" + i][prefix + "RoundTripTime"];
      if(s != null && !("NA" === s) && "0" === s) {
        rtt += 1000 * parseFloat(s);
        ct++;
      }
    }
  } catch (e) {
    console.log(e);
  }
  if (ct > 0) {
    return "" + (rtt/ct);
  }
  return "";
}

function totalBytes(jsonObject, noStats, direction) {
  let bytes = 0;
  try {
    for(let i = 0; i < noStats; i++) {
      let s = jsonObject['candidate-pair_' + i]['bytes' + direction];
      if (s != null && !("NA" === s)) {
        let b = parseFloat(s);
        bytes = Math.max(b, bytes);
      } 
    }
  } catch (e) {
    console.log(e);
  }
  return "" + bytes;
}

function computeBitrate(jsonObject, noStats, direction, mediaType) {
  let bytesStart = 0;
  let bytesEnd = 0;
  let tsStart = 0;
  let tsEnd = 0;
  let avgBitrate = 0;
  let b;
  try {
    if (noStats < 2) {
      console.log("Error: less than 2 stats");
      return;
    }
    let jsonObjName = getJsonObjectName(direction, mediaType);
    let jsonKey = getJsonKey(direction);
    for(let i = 0; i < noStats; i++) {
      let s;
      if(!(jsonObject[jsonObjName + i] === undefined)) {
        s = jsonObject[jsonObjName + i][jsonKey];
      }
      if(s != undefined && !("NA" === s)) {
        b = parseFloat(s);
        bytesStart = (bytesStart == 0 || b < bytesStart) ? b : bytesStart;
        bytesEnd = (bytesEnd == 0 || b > bytesEnd) ? b : bytesEnd;
      }
      let ts;
      if(!(jsonObject[jsonObjName + i] === undefined)) {
        ts = jsonObject[jsonObjName + i]["timestamp"];
      } 
      if (ts != undefined && !("NA" === s)) {
        b = parseFloat(ts);
        if (i === 0) {
          tsStart = b;
        }
        if (i == noStats -1) {
          tsEnd = b;
        }
      }
    }
    if (tsEnd != tsStart) {
      let timediff = (tsEnd - tsStart);
      avgBitrate = Math.abs((8000 * (bytesEnd - bytesStart)) / timediff);
      avgBitrate = Math.round(avgBitrate);
    }
    return "" + avgBitrate;
  } catch (e) {
    console.log(e);
  }
  return "";
}

function computeAudioJitter(jsonObject, noStats) {
  let jitter = 0;
  let ct = 0;
  if (noStats < 2) {
    console.log("Error: less than 2 stats");
    return "";
  }
  try {
    for(let i = 0; i < noStats; i++) {
      let obj = jsonObject["inbound-audio_" + i];
      if (obj != null) {
        let s = obj["jitter"];
        if(s != null && !("NA" === s)) {
          jitter += (1000 * parseFloat(s));
          ct++;
        }
      }
    }
    if (ct > 0) { 
      return "" + (jitter/ct);

    }
  } catch (e) {
    console.log(e);
  }
  return "";
}

function computePacketsLoss(jsonObject, noStats, mediaType) {
  if (noStats < 1) {
    console.log("Error: less than 2 stats");
    return "";
  }
  try {
    obj = jsonObject["inbound-" + mediaType + "_" + (noStats - 1)];
    if(obj != undefined) {
      let s = obj["packetsReceived"];
      let l = obj["packetsLost"];
      if(s != null && !("NA" === s) && l != null && !("NA" === l)) {
        let packetsLost = parseFloat(l);
        let totalPackets = parseFloat(s) + packetsLost;
        if(totalPackets > 0) {
          let packetLoss = packetsLost * 1000 / totalPackets;

          packetLoss = packetLoss / 1000;
          return "" + Math.round(packetLoss * 1000) / 1000;
        }
      } else {
        console.log('computePacketsLoss' + obj);
      }  
    } else {
      console.log("computePacketLoss obj is null" + (" inbound-" + mediaType + "_" + (noStats - 1)));
    }
  } catch (e) {
    console.log(e);
  }
  return "";
}

function getStatsJsonBuilder(jsonObject, stringArray, stats, mediaType) {
  let subBuilder = {};
  if("candidate-pair" === stats) {
    let successfulCandidate = getSuccessfulCandidate(jsonObject);
    if(successfulCandidate != null) {
      for(let i = 0; i < stringArray.length; i++) {
        if(successfulCandidate.hasOwnProperty(stringArray[i])) {
          subBuilder[stringArray[i]] = successfulCandidate[stringArray[i]];
        }
      }
    }
  } else {
    let obj = getRTCStats(jsonObject, stats, mediaType);
    if(obj != null) {
      for(let i = 0; i < stringArray.length; i++) {
        if(obj.hasOwnProperty(stringArray[i])) {
          subBuilder[stringArray[i]] = obj[stringArray[i]];
        }
      }
    }
  }
  return subBuilder;
}


module.exports = {
  extractStats,
  extractJson,
  buildClientStatObject,
}