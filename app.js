const express = require('express')
const app = express()
const path = require('path')
const server = require('http').createServer(app)
const io = require('socket.io')(server)

app.use(express.static(path.join(__dirname, '/public')))

server.listen(3000, () => {
  console.log('Server running @ : ', 3000)
})

io.on('connection', socket => {
  console.log('New connection : ', socket.id)
  socket.emit('created', socket.id)
  socket.on('message', message => {
    socket.broadcast.emit('message', message)
  })
})
