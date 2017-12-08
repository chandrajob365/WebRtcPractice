const socket = io.connect()
const callBtn = document.getElementById('call')
const recvBtn = document.getElementById('recieve')
const disconnectBtn = document.getElementById('disconnect')
const sendBtn = document.getElementById('send')
const msgInputBox = document.getElementById('msgBox')
const msgReceiveBox = document.getElementById('displayMsg')

const config = {
  iceServers: [
    {'urls': 'stun:stun.l.google.com:19302'}
  ]
}
const dataChannelOptions = {
  ordered: false, // do not guarantee order
  maxRetransmitTime: 3000 // in milliseconds
}

let pc = null
let senderDataChannel = null
let recieveDataChannel = null

socket.on('created', clientId => {
  console.log('Client connected : ', clientId)
})

function senderFlow () {
  recvBtn.style.display = 'none'
  msgReceiveBox.style.display = 'none'
  disconnectBtn.removeAttribute('disabled')
  handleSenderPeerConnection()
  socket.on('message', message => {
    console.log('[index.js] message from server : ', message)
    messageHandler(message)
  })
}

const handleSenderPeerConnection = () => {
  console.log('[handleSenderPeerConnection] Entry..')
  createPeerConnection()
  console.log('RTCPeerConnection Created..')
  senderDataChannel = pc.createDataChannel('myLabel', dataChannelOptions)
  console.log('[handleSenderPeerConnection] senderDataChannel = ', senderDataChannel)
  pc.createOffer().then(offer => {
    console.log('offerGenreated, offer : ', offer)
    return pc.setLocalDescription(offer)
  })
  .then(() => {
    console.log('localDescription Set ')
    emitMessage({type: 'offer', desc: pc.localDescription})
  })
  .catch(err => console.log('[createPeerConnection] rejected  error: ', err))
  pc.onicecandidate = handleIceCandidateEvent
  senderDataChannel.onopen = handleSendChannelStatusChage
  senderDataChannel.onclose = handleSendChannelStatusChage
}

const handleIceCandidateEvent = event => {
  console.log('[handleIceCandidateEvent] Entry')
  emitMessage({
    type: 'new-ice-candidate',
    candidate: event.candidate
  })
}

const handleSendChannelStatusChage = event => {
  if (senderDataChannel) {
    let state = senderDataChannel.readyState
    console.log('[handleSendChannelStatusChage] state = ', state)
    if (state === 'open') {
      msgInputBox.removeAttribute('disabled')
      msgInputBox.focus()
      sendBtn.removeAttribute('disabled')
      disconnectBtn.removeAttribute('disabled')
      callBtn.setAttribute('disabled', true)
    } else {
      resetConnection()
      resetView()
    }
  }
}

const messageHandler = message => {
  console.log('[messageHandler] message.type = ', message.type)
  switch (message.type) {
    case 'offer':
      handleOfferSDP(pc, message.desc)
      break
    case 'answer':
      handleAnswerSPD(pc, message.desc)
      break
    case 'new-ice-candidate':
      handleNewIceCandidateMsg(pc, message.candidate)
      break
    default: console.log('Unhandled Case')
  }
}

const handleOfferSDP = (pc, desc) => {
  console.log('[handleOfferSDP] Entry desc : ', desc)
  console.log('[handleOfferSDP] peerConnection = ', pc)
  pc.setRemoteDescription(new RTCSessionDescription(desc))
    .then(() => createAnswer(pc))
    .then(answer => setLocalDescription(pc, answer))
    .then(() => {
      console.log('[handleOfferSDP] Sending to signalling server ::: message : ')
      emitMessage({type: 'answer', desc: pc.localDescription})
    }).catch(err => console.log('err = ', err))
}

const createAnswer = pc => {
  console.log('[createAnswer]')
  return pc.createAnswer()
}

const setLocalDescription = (pc, answer) => {
  console.log('[setLocalDescription] Resolved createAnswer answer : ', answer)
  return pc.setLocalDescription(answer)
}

const handleAnswerSPD = (pc, desc) => {
  console.log('[index.js] desc.type === \'answer\' desc = ', desc)
  pc.setRemoteDescription(desc)
  .then(() => console.log('[handleAnswerSPD] pc = ', pc))
  .catch(err => console.log('error = ', err))
}

const handleNewIceCandidateMsg = (pc, candidate) => {
  if (candidate) {
    pc.addIceCandidate(candidate)
      .then(() => console.log('[handleNewIceCandidateMsg] pc = ', pc))
      .catch(err => console.log('[handleCandidate] err : ', err))
  }
}

// RecieverFlow //
function receiverFlow () {
  socket.on('message', message => {
    console.log('[receiverFlow] pc = ', pc)
    if (!pc) {
      handleRecieverPeerConnection()
    }
    console.log('[index.js] message from server : ', message)
    messageHandler(message)
  })
  callBtn.style.display = 'none'
  msgInputBox.style.display = 'none'
  sendBtn.style.display = 'none'
  recvBtn.setAttribute('disabled', true)
  disconnectBtn.removeAttribute('disabled')
}

const createPeerConnection = () => {
  pc = new RTCPeerConnection(config)
  console.log('[createPeerConnection] pc = ', pc)
}
const handleRecieverPeerConnection = () => {
  console.log('[handleRecieverPeerConnection]')
  createPeerConnection()
  pc.onicecandidate = handleIceCandidateEvent
  pc.ondatachannel = receiveChannelCallback
}

const receiveChannelCallback = event => {
  recieveDataChannel = event.channel
  console.log('[receiveChannelCallback] recieveChannel = ', event.channel)
  recieveDataChannel.onmessage = handleReceiveMessage
  recieveDataChannel.onopen = handleReceiveChannelStatusChange
  recieveDataChannel.onclose = handleReceiveChannelStatusChange
}

const handleReceiveMessage = event => {
  let el = document.createElement('p')
  let txtNode = document.createTextNode(event.data)
  el.appendChild(txtNode)
  msgReceiveBox.appendChild(el)
}

const handleReceiveChannelStatusChange = event => {
  if (recieveDataChannel) {
    let state = recieveDataChannel.readyState
    console.log('[handleReceiveChannelStatusChange] state = ', state)
    if (state === 'closed') {
      resetConnection()
      resetView()
    }
  }
}

const emitMessage = msg => {
  socket.emit('message', msg)
}

const sendMsg = msg => {
  let message = msgInputBox.value
  senderDataChannel.send(message)
  msgInputBox.value = ''
  msgInputBox.focus()
}

const disconnectPeers = () => {
  console.log('[disconnectPeers] Entry...')
  if (senderDataChannel) senderDataChannel.close()
  if (recieveDataChannel) recieveDataChannel.close()
  resetConnection()
  resetView()
}

const resetConnection = () => {
  console.log('[resetConnection] Entry')
  if (pc) pc.close()
  pc = null
  senderDataChannel = null
  recieveDataChannel = null
}

const resetView = () => {
  console.log('[resetView] Entry')
  callBtn.style.display = 'inline'
  recvBtn.style.display = 'inline'
  recvBtn.removeAttribute('disabled')
  callBtn.removeAttribute('disabled')
  disconnectBtn.setAttribute('disabled', true)
  msgInputBox.style.display = 'inline'
  msgInputBox.setAttribute('disabled', true)
  sendBtn.style.display = 'inline'
  sendBtn.setAttribute('disabled', true)
  msgReceiveBox.inlineHTML = ''
}
