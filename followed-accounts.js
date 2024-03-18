import { db } from "./dbInstance.js";

function formatDate(dateString) {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  };
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", options);
}

async function displayFollowedActors() {
  const followedListElement = document.getElementById("followedList");
  const followedActors = await db.getFollowedActors();
  console.log(followedActors);

  followedActors.forEach((actor) => {
    const actorElement = document.createElement("div");
    const formattedDate = formatDate(actor.followedAt);
    actorElement.textContent = `- Followed URL: ${actor.url} - Followed At: ${formattedDate}`;
    followedListElement.appendChild(actorElement);
  });
}
displayFollowedActors();

export async function updateFollowCount() {
  const followCountElement = document.getElementById("followCount");
  const followedActors = await db.getFollowedActors();
  followCountElement.textContent = followedActors.length;
}

// test following/unfollowing
// (async () => {
//   const actorUrl1 = "https://example.com/actor/1";
//   const actorUrl2 = "https://example.com/actor/2";

//   console.log("Following actors...");
//   await db.followActor(actorUrl1);
//   await db.followActor(actorUrl2);

//   console.log("Retrieving followed actors...");
//   let followedActors = await db.getFollowedActors();
//   console.log("Followed Actors:", followedActors);

//   console.log("Unfollowing an actor...");
//   await db.unfollowActor(actorUrl2);

//   console.log("Retrieving followed actors after unfollowing...");
//   followedActors = await db.getFollowedActors();
//   console.log("Followed Actors after unfollowing:", followedActors);
// })();
