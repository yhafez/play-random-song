const fs = require('fs')
const path = require('path')
const player = require('play-sound')

const musicFolder = '/Volumes/DJ 2/Music'

let audioProcess
let isPlaying = false
let currentTrackIndex
let trackHistory = []
let forwardTrackHistory = []

const playTrack = (trackPath, autoplayNext = true) => {
	if (audioProcess) {
		audioProcess.removeAllListeners('exit')
		audioProcess.kill()
	}

	audioProcess = player().play(trackPath, err => {
		if (err) console.error(`Could not play the audio file: ${err}`)
	})

	isPlaying = true

	// Set up an event listener to autoplay the next track when the current track ends
	if (autoplayNext) {
		audioProcess.on('exit', () => {
			if (isPlaying) playNextTrack()
		})
	}
}

const playNextTrack = () => {
	if (forwardTrackHistory.length > 0) {
		// Use the track from the forward history if available
		currentTrackIndex = forwardTrackHistory.pop()
	} else {
		// Avoid picking the current track as the next track
		let potentialNextTrackIndices = audioFiles.map((_, index) => index).filter(index => index !== currentTrackIndex)

		// If we've played all the tracks, reset the history
		if (potentialNextTrackIndices.length === 0) {
			potentialNextTrackIndices = audioFiles.map((_, index) => index)
			trackHistory = []
		}

		// Pick a random track from the remaining tracks
		currentTrackIndex = potentialNextTrackIndices[Math.floor(Math.random() * potentialNextTrackIndices.length)]
	}

	trackHistory.push(currentTrackIndex)

	const nextFilePath = path.join(musicFolder, audioFiles[currentTrackIndex])

	loadMetadata(nextFilePath)
	playTrack(nextFilePath)

	console.log('Playing next track')
}

const stopTrack = () => {
	if (audioProcess) {
		audioProcess.kill()
		isPlaying = false
	}
}

const loadMetadata = trackPath => {
	import('music-metadata')
		.then(mm => {
			mm.parseFile(trackPath)
				.then(metadata => {
					const artist = metadata.common.artist || 'Unknown artist'
					const title = metadata.common.title || 'Unknown title'
					console.log(`Loaded: ${title} by ${artist}`)
				})
				.catch(err => {
					console.error('Error reading metadata:', err)
				})
		})
		.catch(err => {
			console.error('Error importing music-metadata library:', err)
		})
}

let audioFiles = []

fs.readdir(musicFolder, (err, files) => {
	if (err) {
		console.error('Could not list the directory.', err)
		process.exit(1)
	}

	audioFiles = files.filter(file => file.endsWith('.mp3') || file.endsWith('.wav'))

	if (audioFiles.length === 0) {
		console.error('No audio files found.')
		process.exit(1)
	}

	currentTrackIndex = Math.floor(Math.random() * audioFiles.length)
	trackHistory.push(currentTrackIndex)

	const randomFilePath = path.join(musicFolder, audioFiles[currentTrackIndex])

	loadMetadata(randomFilePath)
	playTrack(randomFilePath)
})

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.on('data', data => {
	const key = data.toString()
	if (key === ' ') {
		// Spacebar
		if (isPlaying) {
			stopTrack()
			console.log('Paused playback')
		} else {
			playTrack(path.join(musicFolder, audioFiles[currentTrackIndex]))
			console.log('Resumed playback')
			audioProcess.on('exit', () => {
				if (isPlaying) playNextTrack()
			})
		}
	}

	if (key === '\u001b[C') {
		// Right arrow key
		playNextTrack()
	}

	if (key === '\u001b[D') {
		// Left arrow key
		if (forwardTrackHistory.length > 0) {
			currentTrackIndex = forwardTrackHistory.pop()
		} else if (trackHistory.length > 1) {
			trackHistory.pop() // Remove the current track
			currentTrackIndex = trackHistory[trackHistory.length - 1] // Get the previous track
		} else {
			console.log('No previous track in history')
			return
		}
		const previousFilePath = path.join(musicFolder, audioFiles[currentTrackIndex])
		loadMetadata(previousFilePath)
		playTrack(previousFilePath)
		console.log('Playing previous track')
	}

	if (key === '\u001b[B') {
		// Down arrow key
		currentTrackIndex = (currentTrackIndex + 1) % audioFiles.length
		trackHistory.push(currentTrackIndex)
		forwardTrackHistory = [] // Reset the forward track history as we are making a new selection
		const nextFilePathInFolder = path.join(musicFolder, audioFiles[currentTrackIndex])
		loadMetadata(nextFilePathInFolder)
		playTrack(nextFilePathInFolder)
		console.log('Playing next track in the folder')
	}

	if (key === '\u001b[A') {
		// Up arrow key
		currentTrackIndex = (currentTrackIndex - 1 + audioFiles.length) % audioFiles.length
		trackHistory.push(currentTrackIndex)
		forwardTrackHistory = [] // Reset the forward track history as we are making a new selection
		const previousFilePathInFolder = path.join(musicFolder, audioFiles[currentTrackIndex])
		loadMetadata(previousFilePathInFolder)
		playTrack(previousFilePathInFolder)
		console.log('Playing previous track in the folder')
	}

	if (key.toLowerCase() === 'q' || key === '\u001b') {
		// Q or Esc
		if (audioProcess) {
			audioProcess.kill()
		}
		console.log('Exiting...')
		process.exit(0)
	}
})
