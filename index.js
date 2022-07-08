// apologies for over-documenting this code. I'm writing this now
// and will have to touch it again in like 9 months, and will forget
// everything about it.

require('dotenv').config()

const { parseArgs } = require('node:util')
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { DateTime } = require('luxon')
const { Octokit } = require("@octokit/rest");

const args = ['-p', './lmao/', '-t','lol.md', '-s', 'meeting.json', '-g']

const options = {
  path: {
    type: 'string',
    short: 'p'
  },
  template: {
    type: 'string',
    short: 't'
  },
  shortcodes: {
    type: 'string',
    short: 's'
  },
  github: {
    type: 'boolean',
    short: 'g'
  }
}

const { values } = parseArgs({args, options})

// create a filename based off of the current date
function createFilename () {
  const now = DateTime.now()
  const filename = now.toISODate()

  return `${filename}.md`
}

// replace shortcodes with their values
function replaceShortcodes (templateContents) {
  const variables = JSON.parse(readFileSync(values.shortcodes, 'utf8')) // read the passed shortcodes file
  const shortcodes = { // our legend for shortcodes. if you want more, add them here!
    title: '[/title/]',
    description: '[/description/]',
    meetingLabel: '[/meetingLabel/]',
    agendaItemLabel: '[/agendaItemLabel/]',
    startTime: '[/startTime/]',
    endTime: '[/endTime/]',
    meetingUrl: '[/meetingUrl/]',
    invited: '[/invited/]',
    observers: '[/observers/]',
    agenda: '[/agenda/]',
    organization: '[/organization/]',
    repo: '[/repo/]'
  }

  if (values.shortcodes) {
    // first, handle any properties from the shortcodes file that augment shortcodes

    // we're using the `modifiedShortcodes` object to store the values of shortcodes
    // that are modified by user-passed input in the shortcodes file. every value in
    // this object should follow the following pattern:
    // - have the same key as an existing shortcode
    // - have the value be an object
    // - the value object should contain two properties:
    //   - `original`: the original value, as found in the shortcodes variable
    //   - `modified`: the modified value 
    //
    // this is mostly done to ensure that we're able to accurately transform
    // the shortcodes data while still having an easy way to tack what we're doing.
    // `original` might be unnecessary, but it's nice to have.
    const modifiedShortcodes = {}

    // this handles the `titleWithDate` property in the shortcodes file.
    // it specifically appends the date to the meeting title.
    if (variables.titleWithDate === true) {
      const now = DateTime.now()
      modifiedShortcodes.title = {
        original: '[/title/]',
        modified: `[/title/] - ${now.toISODate()}`
      }
    }

    // now, handle shortcodes

    // this is a bit dense, but:
    //
    // if the shortcodes flag is passed, read the passed file (must be JSON) and if there are
    // properties that are in that file that are within the above list of shortcodes, replace
    // any instances of them in the template with the associated value from the shortcodes file
    Object.keys(variables).forEach(key => { 
      // useful for getting all the information we need out of this wonky setup:
      // console.log(key, modifiedShortcodes[key], shortcodes[key], variables[key])
      if(shortcodes[key] && variables[key]) {
        if(modifiedShortcodes[key]){
          templateContents = templateContents.replace(shortcodes[key], modifiedShortcodes[key].modified)
        } else {
          templateContents = templateContents.replace(shortcodes[key], variables[key])
        }
      }
    })
  }

  return templateContents
}

// similar to the above function, but for GitHub specific shortcodes.
function replaceGitHubShortcodes (templateContents) {
  // we do this auth here rather than at the top in case
  // the user *does not* want GitHub authorization.
  // 
  // i'm not sure who that user is, but wanted to support them.
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  })

  const variables = JSON.parse(readFileSync(values.shortcodes, 'utf8')) // read the passed shortcodes file
  const shortcodes = { // legend for shortcodes. if you want more GitHub specific things, add them here!
    latestMeetingUrl: '[/latestMeetingPullRequestUrl/]',
    latestMeetingNumber: '[/latestMeetingPullRequestNumber/]'
  }

  console.log(variables.owner, variables.repo)

  // const pulls = octokit.rest.pulls.list({
  //   variables.owner,
  //   variables.repo,
  // })

  // console.log(pulls)

  return templateContents
}

// collects the template that we've passed in and returns the contents as a string
function getTemplateContents (template) {
  const resolvedPathToTemplate = resolve(template) // resolve the relative path that we're expecting
  const contents = readFileSync(resolvedPathToTemplate, 'utf8') // read the file
  const shortcodesReplaced = replaceShortcodes(contents) // replace shortcodes with their values
  const githubReplaced = replaceGitHubShortcodes(shortcodesReplaced) // replace GitHub specific shortcodes
  const finalContents = githubReplaced // return the final contents
  return finalContents
}

// currently not checking if the path exists and making it if it doesn't. we should do that.
function writeTemplate(template, path) {
  const templateContents = getTemplateContents(template) // get our template content 
  const filename = createFilename() // create a filename that is the current date as an ISO date
  const finalPath = join(resolve(path), filename) // join the (resolved) path and the generated filename
  return writeFileSync(finalPath, templateContents) // write the file with template content to our desired location
}


// does the thing - specifically, writes the file where we want it
writeTemplate(values.template, values.path)
