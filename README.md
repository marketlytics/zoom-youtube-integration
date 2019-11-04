# zoom-youtube-intergration

An object with meeting meta-data is sent from webhook, registered on Zoom, and then upload that meeting to the authorize YouTube Channel. Zoom meeting meta-data is then save in SQL database to prevent duplication upload. 
We can later use the database for further integration.

## Summary
**Agency**
MarketLytics

**Heroku App URL**
https://zoom-youtube.herokuapp.com/

**Heroku Git URL**
https://git.heroku.com/zoom-youtube.git

**Article**
[Will be added]()

**Zoom**
For webhook references click on the following link https://marketplace.zoom.us/docs/api-reference/webhook-reference 
## Setup Webhook
 1. Go to https://marketplace.zoom.us 
 2. Login with your credentials. 
 3. Click on Develop on top-right corner and from dropdown click Build App.
 4. Choose your app type. (In my case i have chosen JWT becasue it is used to establish server-to-server interaction for Zoom API) and fill out all the required information
 5. Then in features tab, enable Event Subscription and write down your event notification endpoint URL i.e <your-app-url>/send_recording. (Remeber this is a POST request)
 6. Down below in event type add recording -> All recordings have been completed as an event in this app. Then click saves and continues.
 7. Your App will be Activated.

**Youtube**
## Setup Youtube API 
 1. Go to https://console.developers.google.com 
 2. Create Project and enable Youtube Data API. 
 3. Setup OAuth Consent Screen and add your heroku app in aurthorized domain then click saves.
 4. Go to credentials tab, click credentails and from dropdown click OAuth client ID then select your application type as web application.
 5. Add your heroku app URL in <your-app-url> Authorized JavaScript origins and <your-app-url>/oauth2callback in Authorized redirect URIs, then click saves.
 6. Download your credentials file and rename it to client_secret.json and save it to your project folder.

## Run the Code
 1. Replace the client_secret.json file in the project folder.
 2. Replace DB credentials with your db credentials in db.js. 
 3. Login heroku in your terminal.
 4. Commit and push all your code on heroku app repository.
 5. Create a meeting on zoom and test your code. 
