//Get token, id, secret, and group_message_id from keys.js file
const {keys} = require('./keys')
let myToken = keys.myToken
let id = keys.id
let secret = keys.secret
let group_message_id = keys.group_message_id
var chrono = require('chrono-node')

//Google calendar API
const { google } = require('googleapis')
const { OAuth2 } = google.auth
const oAuth2Client = new OAuth2(
  keys.calendar_client_id,
  keys.calendar_client_secret
)
oAuth2Client.setCredentials({
  refresh_token: keys.refresh_token,
})


//Define functions

//Only display if 2/3 of the fields are available
function showRow(parsedDate, toLoc, fromLoc){
    if (parsedDate && toLoc && fromLoc){
        return true;
    }
    else{
        return false;
    }
}

//Create Event function
function createEvent(parsedDate, fromLoc, toLoc, message){
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

    const eventStartTime = new Date(parsedDate)
    eventStartTime.setDate(parsedDate.getDate())
    console.log(`Start Time: ${eventStartTime}`)

    const eventEndTime = new Date(parsedDate)
    eventEndTime.setDate(parsedDate.getDate())
    eventEndTime.setMinutes(eventEndTime.getMinutes() + 15)
    console.log(`End Time: ${eventEndTime}`)

    const event = {
        summary: 'Ride',
        location: `From ${fromLoc} | To ${toLoc}`,
        description: message,
        start: {
            dateTime: eventStartTime,
            timeZone: 'America/New_York'
        },
        end: {
            dateTime: eventEndTime,
            timeZone: 'America/New_York'
        }
    }
    checkDupe(eventStartTime, eventEndTime, message, calendar, event)
}

//Check if ride has already been input to the
function checkDupe(eventStartTime, eventEndTime, message, calendar, event){
    calendar.freebusy.query(
        {
          resource: {
            timeMin: eventStartTime,
            timeMax: eventEndTime,
            description: message,
            timeZone: 'America/New_York',
            items: [{ id: 'primary' }],
          },
        },
        (err, res) => {
          // Check for errors in our query and log them if they exist.
          if (err) return console.error('Free Busy Query Error: ', err)
      
          // Create an array of all events on our calendar during that time.
          const eventArr = res.data.calendars.primary.busy
          console.log("Array:")
          console.log(eventArr)
      
          // Check if event array is empty which means we are not busy
          if (eventArr.length === 0)
            // If we are not busy create a new calendar event.
            return calendar.events.insert(
              { calendarId: 'primary', resource: event },
              err => {
                // Check for errors and log them if they exist.
                if (err) return console.error('Error Creating Calender Event:', err)
                // Else log that the event was created.
                return console.log('Calendar event successfully created.')
              }
            )
      
          // If event array is not empty log that we are busy.
          return console.log('Already there!')
        }
      )
}



//Fetch data from Facebook
fetch(`https://graph.facebook.com/oauth/access_token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`)
  .then(response => response.json())
  .then(token => (myToken = token.access_token))
  .catch(e => console.log(e))

fetch(`https://graph.facebook.com/v16.0/${group_message_id}/feed?fields=message%2Cupdated_time&access_token=${myToken}`)
.then(response => response.json())
.then(data => {
   
   //Iterate through JSON
    data.data.forEach(item => {
        //Format message if a message exists
       var message = item.message
       if (!message){
        return
       }
       message = message.replace(/[*\n]/g, '');
        
       //Get date from message using chrono module 
       var parsedDate = ""
       if(!chrono.parseDate(message, new Date(item.updated_time))){
        return
       }
       parsedDate = new Date(chrono.parseDate(message, new Date(item.updated_time)));

        // Get From & To location
        var fromLoc="" 
        if (message.includes("from")){
            fromLoc = (message).split("from ")[1].split(" ")[0]
        }

        var toLoc=""
        if (message.includes("to ")){
            toLoc = (message).split("from")[1].split("to ")[1]
            if (toLoc.includes(" ")){
                toLoc = toLoc.split(" ")[0]
            }
        }
        
        /* Also check the following:
        1) Not a back and forth trip
        2) Weird spacing (double spaces)
        3) What if there's "tomorrow" or "today" and you have to before from
        4) When there is a "this morning at 10" it assumes 7am instead of taking 10
        5) Some people don't use "To/From"
        6) Some people use "/" eg. "Yorkdale/Scarborough" 
        7) Places with more than one words
        */

        if (showRow(parsedDate, toLoc, fromLoc)){
            createEvent(parsedDate, fromLoc, toLoc, message)
        }
    });

});