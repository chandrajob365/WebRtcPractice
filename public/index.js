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
  maxPacketLifeTime: 3000 // in milliseconds
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
  socket.on('message', handleSenderFlowMsg)
}

const handleSenderFlowMsg = message => {
  messageHandler(message)
}

const handleSenderPeerConnection = () => {
  createPeerConnection()
  senderDataChannel = pc.createDataChannel('myLabel', dataChannelOptions)
  pc.createOffer().then(offer => pc.setLocalDescription(offer))
  .then(() => {
    emitMessage({type: 'offer', desc: pc.localDescription})
  })
  .catch(err => console.log('[createPeerConnection] rejected  error: ', err))
  pc.onicecandidate = handleIceCandidateEvent
  senderDataChannel.onopen = handleSendChannelStatusChage
  senderDataChannel.onclose = handleSendChannelStatusChage
}

const handleIceCandidateEvent = event => {
  emitMessage({
    type: 'new-ice-candidate',
    candidate: event.candidate
  })
}

const handleSendChannelStatusChage = event => {
  if (senderDataChannel) {
    let state = senderDataChannel.readyState
    if (state === 'open') {
      msgInputBox.removeAttribute('disabled')
      msgInputBox.focus()
      sendBtn.removeAttribute('disabled')
      disconnectBtn.removeAttribute('disabled')
      callBtn.setAttribute('disabled', true)
    } else {
      resetConnection()
      resetView()
      socket.removeEventListener('message', handleSenderFlowMsg)
    }
  }
}

const messageHandler = message => {
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
  pc.setRemoteDescription(new RTCSessionDescription(desc))
    .then(() => createAnswer(pc))
    .then(answer => setLocalDescription(pc, answer))
    .then(() => {
      emitMessage({type: 'answer', desc: pc.localDescription})
    }).catch(err => console.log('err = ', err))
}

const createAnswer = pc => {
  return pc.createAnswer()
}

const setLocalDescription = (pc, answer) => {
  return pc.setLocalDescription(answer)
}

const handleAnswerSPD = (pc, desc) => {
  pc.setRemoteDescription(desc)
  .catch(err => console.log('error = ', err))
}

const handleNewIceCandidateMsg = (pc, candidate) => {
  if (candidate) {
    pc.addIceCandidate(candidate)
      .catch(err => console.log('[handleCandidate] err : ', err))
  }
}

// RecieverFlow //
function receiverFlow () {
  socket.on('message', handleRecieverFlowMsg)
  callBtn.style.display = 'none'
  msgInputBox.style.display = 'none'
  sendBtn.style.display = 'none'
  msgReceiveBox.style.display = 'block'
  recvBtn.setAttribute('disabled', true)
  disconnectBtn.removeAttribute('disabled')
}

const handleRecieverFlowMsg = message => {
  if (!pc) {
    handleRecieverPeerConnection()
  }
  messageHandler(message)
}

const createPeerConnection = () => {
  pc = new RTCPeerConnection(config)
}
const handleRecieverPeerConnection = () => {
  createPeerConnection()
  pc.onicecandidate = handleIceCandidateEvent
  pc.ondatachannel = receiveChannelCallback
}

const receiveChannelCallback = event => {
  recieveDataChannel = event.channel
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
    if (state === 'closed') {
      resetConnection()
      resetView()
      socket.removeEventListener('message', handleRecieverFlowMsg)
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
  if (senderDataChannel) {
    senderDataChannel.close()
    socket.removeEventListener('message', handleSenderFlowMsg)
  }
  if (recieveDataChannel) {
    recieveDataChannel.close()
    socket.removeEventListener('message', handleRecieverFlowMsg)
  }
  resetConnection()
  resetView()
}

const resetConnection = () => {
  if (pc) pc.close()
  pc = null
  senderDataChannel = null
  recieveDataChannel = null
}

const resetView = () => {
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
