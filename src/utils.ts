export function nextFiveSecondMark(now = new Date()) {
    const currentSeconds = now.getSeconds()
    const remainingSeconds = 5 - (currentSeconds % 5)

    now.setSeconds(now.getSeconds() + remainingSeconds)
    now.setMilliseconds(0)

    return now.getTime()
}