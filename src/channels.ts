import { backendUrl } from "./backend"
import { reloadMessageBacklog } from "./message_loader"
import { getPlugins } from "./plugins/plugins"
import { JoinChannel, JoinChannelResponse } from "./socket.io"
import { getSocket } from "./ws_connection"

let currentChannelName: string | null = null
let currentServerName: string | null = null
const nameDom: HTMLElement = document.querySelector('.channel-name')
const messageInp: HTMLInputElement = document.querySelector('#message-input')
const textChannelsDom: HTMLElement = document.querySelector('.text-channels')

interface ChannelInfo {
    name: string
}

interface ServerInfo {
    name: string,
    channels: ChannelInfo[]
}

/*
    connectedServers

    key: server name
    value: ServerInfo
*/
const connectedServers: Record<string, ServerInfo> = {}

const updateChannelInfo = (serverName: string, channelNames: string[]) => {
    if (!connectedServers[serverName]) {
        connectedServers[serverName] = {
            name: serverName,
            channels: []
        }
    }
    const channels: ChannelInfo[] = channelNames.map((name) => {
        const channelInfo: ChannelInfo = {
            name: name
        }
        return channelInfo
    })
    connectedServers[serverName].channels = channels
}

const requestSwitchChannel = (serverName: string, channelName: string) => {
    const joinRequest: JoinChannel = {
        channel: channelName,
        server: serverName,
        password: 'none'
    }
    getSocket().emit('joinChannel', joinRequest)
}

const switchChannel = (serverName: string, channelName: string) => {
    // console.log(`Switching to channel ${serverName}#${channelName}`)
    const oldServer = getActiveServer()
    const oldChannel = getActiveChannel()
    setActiveServer(serverName)
    setActiveChannel(channelName)
    reloadMessageBacklog()
    getPlugins().forEach((plugin) => {
        plugin.onSwitchChannel(oldServer, oldChannel, serverName, channelName)
    })
}

getSocket().on('joinChannelResponse', (response: JoinChannelResponse) => {
    if (response.success) {
        switchChannel(response.server, response.channel)
        return
    }
    console.log(`failed to switch channel! todo error toast in ui`)
})

export const highlightNewMessageInChannel = (channel: string) => {
    const channelDom: HTMLElement | null = document.querySelector(`[data-channel-name="${channel}"]`)
    if (!channelDom) {
        console.log(`[!] WARNING! failed to find channel with name '${channel}'`)
        return
    }
    channelDom.classList.add('new-messages')
}

export const highlightNewPingInChannel = (channel: string) => {
    const channelDom: HTMLElement | null = document.querySelector(`[data-channel-name="${channel}"]`)
    if (!channelDom) {
        console.log(`[!] WARNING! failed to find channel with name '${channel}'`)
        return
    }
    const numPingsDom: HTMLElement = channelDom.querySelector('.num-pings')
    numPingsDom.classList.add('active')
    const numPings: number = parseInt(numPingsDom.innerText, 10)
    numPingsDom.innerHTML = (numPings + 1).toString()
}

const renderChannelList = (serverName: string) => {
    textChannelsDom.innerHTML = ''
    if (!connectedServers[serverName]) {
        return
    }
    connectedServers[serverName].channels.forEach((channel: ChannelInfo) => {
        const active = channel.name === getActiveChannel() ? ' active' : ''
        textChannelsDom.innerHTML += 
            `<div class="channel-name-box clickable${active}" data-channel-name="${channel.name}">
                <span>
                    <span class="text-light">#</span>
                    <span class="channel-name">${channel.name}</span>
                </span>
                <span class="num-pings">0</span>
            </div>`
    })
    const clickableChannels: NodeListOf<HTMLElement> = document.querySelectorAll('.clickable.channel-name-box')
    clickableChannels.forEach((channel) => {
        channel.addEventListener('click', () => {
            const channelNameDom: HTMLElement | null = channel.querySelector('.channel-name')
            const oldActive: HTMLElement = document.querySelector('.text-channels .active')
            const numPingsDom: HTMLElement = channel.querySelector('.num-pings')
            oldActive.classList.remove('active')
            oldActive.classList.remove('new-messages')
            numPingsDom.classList.remove('active')
            channel.classList.add('active')
            channel.classList.remove('new-messages')
            requestSwitchChannel(getActiveServer(), channelNameDom.innerText)
        })
    })
}

// channel

export const setActiveChannel = (channelName: string) => {
    currentChannelName = channelName
    nameDom.innerHTML = channelName
    messageInp.placeholder = `Message #${channelName}`
    document.title = `#${channelName}`
}

export const getActiveChannel = (): string => {
    if (!currentChannelName) {
        const params = new URLSearchParams(document.location.search)
        currentChannelName = params.get('c') || 'developer'
        setActiveChannel(currentChannelName)
    }
    return currentChannelName
}

// server

export const setActiveServer = (serverName: string) => {
    currentServerName = serverName
    // TODO: highlight icon on the left
}

export const getActiveServer = (): string => {
    if (!currentServerName) {
        const params = new URLSearchParams(document.location.search)
        currentServerName = params.get('s') || 'ddnet'
        setActiveServer(currentServerName)
    }
    return currentServerName
}

// get info

fetch(`${backendUrl}/${getActiveServer()}/channels`)
    .then(data => data.json())
    .then((channels: string[]) => {
        updateChannelInfo(getActiveServer(), channels)
        renderChannelList(getActiveServer())
    })