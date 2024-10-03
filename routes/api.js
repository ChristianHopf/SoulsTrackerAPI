const express = require("express");
const router = express.Router();

/**
 * ~~~~~~~~~~~~~~~
 * Appid - Title
 * ~~~~~~~~~~~~~~~
 * 570940 - DARK SOULS™: REMASTERED
 * 236430 - DARK SOULS™ 2
 * 374320 - DARK SOULS™ 3
 * 1245620 - ELDEN RING
 * GetOwnedGames takes an array of appids:
 * - appids_filter[0]=440&appids_filter[1]=570
 * Note on the above: Following Steam's documentation (&input_json={appids_filter: [570940, ...]}) doesn't work,
 * but the TF2 wiki has accurate documentation for some reason. Didn't expect the hat game to come in clutch like this
 * https://wiki.teamfortress.com/wiki/WebAPI/GetOwnedGames
 */
const SUPPORTED_GAMES_FILTER =
  "appids_filter[0]=570940&appids_filter[1]=236430&appids_filter[2]=374320&appids_filter[3]=1245620";

/**
 * Usage: GET /user-profile/:steamid
 * Route params:
 * - steamid (ex. 76561198099631791)
 * Returns:
 * - steamid: string
 * - personaname: string
 * - avatarmedium: string
 * Uses Steam API endpoint: https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=APIKEY&steamids=[steamids]
 * - Query params:
 *   - key: API key
 *   - steamids: list of steamids (could be a list with multiple steamids, but we only want to fetch data for one)
 */
router.get("/user-profile/:steamid", async (req, res, next) => {
  try {
    // Steamid validation
    // If steamid is not a number (NaN), NaN !== NaN
    if (
      !req.params.steamid ||
      parseInt(req.params.steamid) !== parseInt(req.params.steamid)
    ) {
      return res.status(400).json({
        error: true,
        message: "Invalid SteamID",
      });
    }

    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.API_KEY}&steamids=${req.params.steamid}`
    );
    if (!response.ok) {
      console.error(`Error: Received status ${response.status}`);
      return res.status(response.status).json({
        error: true,
        message: `Failed to fetch data with status ${response.status}`,
      });
    }

    const data = await response.json();

    // Response returns an empty players array if no user exists with given steamid
    if (data.response.players.length == 0) {
      return res.status(404).json({
        error: true,
        message: `User with steamid ${req.params.steamid} not found`,
      });
    }

    // Return object with the steamid, personaname, and avatarmedium properties
    const user = data.response.players[0];
    // console.log(data);
    res.json({
      steamid: req.params.steamid,
      personaname: user.personaname,
      avatarmedium: user.avatarmedium,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Usage: GET /owned-games/:steamid
 * Route params:
 * - steamid (ex. 76561198099631791)
 * Returns list of all games in supportedgames.json that are in the library of the user with the given steamid,
 * in the following form:
 * Uses Steam API endpoint:
 * https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=APIKEY&steamid=steamid&include_appinfo=1&include_played_free_games=1&appids_filter=[570940,...,1245620]&include_free_sub=1&language=english&include_extended_appinfo=0&format=json
 * - Query params:
 *   - key: API key
 *   - steamids: list of steamids (could be a list with multiple steamids, but we only want to fetch data for one)
 * STEAM API RESPONSE:
 * {
  "response": {
    "game_count": 1,
    "games": [
      {
        "appid": 570940,
        "name": "DARK SOULS™: REMASTERED",
        "playtime_2weeks": 649,
        "playtime_forever": 4206,
        "img_icon_url": "d74cfa4f3a2070f45ad8ce44e5f61a6507ee00b6",
        "has_community_visible_stats": true
      }
    ]
  }
}
 * RESPONSE:
 * [
  {
    "id": "dark-souls-remastered",
    "name": "DARK SOULS™: REMASTERED",
    "appid": 570940
  }
]
 */

router.get("/owned-games/:steamid", async (req, res, next) => {
  try {
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${
        process.env.API_KEY
      }&steamid=${
        req.params.steamid
      }&include_appinfo=1&include_played_free_games=1&${SUPPORTED_GAMES_FILTER.toString()}&include_free_sub=1&language=english&include_extended_appinfo=0&format=json`
    );
    if (!response.ok) {
      console.error(`Error: Received status ${response.status}`);
      return res.status(response.status).json({
        error: true,
        message: `Failed to fetch data with status ${response.status}`,
      });
    }
    const data = await response.json();

    // If the user has none of the supported games, return an empty array
    if (data.response.game_count == 0) {
      return res.json([]);
    }

    // If the user has at least one of the supported games, return an array of Games for each game
    let result = [];
    data.response.games.forEach((game) => {
      let id;
      switch (game.name) {
        case "DARK SOULS™: REMASTERED":
          id = "dark-souls-remastered";
          break;
        case "DARK SOULS™ II":
          id = "dark-souls-2";
          break;
        case "DARK SOULS™ III":
          id = "dark-souls-3";
          break;
        default:
          id = "elden-ring";
      }
      // A game has:
      // - id: game id for frontend
      // - displayName: game title
      // - appid: game appid
      const newGame = {
        id: id,
        name: game.name,
        appid: game.appid,
      };
      result.push(newGame);
    });
    console.log(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Usage: GET /playtime/:steamid/:appid
 * Route params:
 * - steamid (ex. 76561198099631791)
 * - appid (ex. 570940 for Dark Souls Remastered)
 * Uses Steam API endpoint: https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=APIKEY&steamid=steamid&include_appinfo=1&include_played_free_games=1&appids_filter[0]=appid&include_free_sub=1&language=english&include_extended_appinfo=0&format=json
 * - Query params:
 *   - key: API key
 *   - steamid: user's steamid
 *   - appids_filter[0]: appid (appids_filter could be a list with multiple appids, but we only want to fetch data for one)
 * STEAM API RESPONSE:
 * {
  "response": {
    "game_count": 1,
    "games": [
      {
        "appid": 1245620,
        "name": "ELDEN RING",
        "playtime_2weeks": 1612,
        "playtime_forever": 1612,
        "img_icon_url": "b6e290dd5a92ce98f89089a207733c70c41a1871",
        "has_community_visible_stats": true,
        "playtime_windows_forever": 1612,
        "playtime_mac_forever": 0,
        "playtime_linux_forever": 0,
        "playtime_deck_forever": 0,
        "rtime_last_played": 1725168829,
        "content_descriptorids": [
          2,
          5
        ],
        "playtime_disconnected": 0
      }
    ]
  }
}
 * RESPONSE:
 * {
 *   "data": {
 *     playtime_forever: number, user's total Steam hours ingame
 *     playtime_2weeks: number, user's total Steam hours ingame over the last 2 weeks
 *   }
 * }
 */
router.get("/playtime/:steamid/:appid", async (req, res, next) => {
  try {
    // 76561198099631791
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${process.env.API_KEY}&steamid=${req.params.steamid}&include_appinfo=1&include_played_free_games=1&appids_filter[0]=${req.params.appid}&include_free_sub=1&language=english&include_extended_appinfo=0&format=json`
    );
    if (!response.ok) {
      console.error(`Error: Received status ${response.status}`);
      return res.status(response.status).json({
        error: true,
        message: `Failed to fetch data with status ${response.status}`,
      });
    }
    const data = await response.json();
    console.log(data);

    // Add case where response is empty (some kind of error on Steam's side?)

    // res.json(data);
    // If the user hasn't played the game in the last 2 weeks,
    // the playtime_2weeks property is absent
    data.response.games[0].playtime_2weeks
      ? res.json({
          data: {
            playtime_forever: (
              data.response.games[0].playtime_forever / 60
            ).toFixed(1),
            playtime_2weeks: (
              data.response.games[0].playtime_2weeks / 60
            ).toFixed(1),
          },
        })
      : res.json({
          data: {
            playtime_forever: (
              data.response.games[0].playtime_forever / 60
            ).toFixed(1),
            playtime_2weeks: 0,
          },
        });
  } catch (err) {
    next(err);
  }
});

/**
 * Usage: GET /bosses/:steamid/:appid
 * Route params:
 * - steamid (ex. 76561198099631791)
 * - appid (ex. 570940 for Dark Souls Remastered)
 * Uses Steam API endpoint: https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid={req.params.appid}&key=${process.env.API_KEY}&steamid=${req.params.steamid}
 * - Query params:
 *   - key: API key
 *   - steamid
 *   - appid
 * STEAM API RESPONSE:
 * {
    "playerstats": {
      "steamID": "76561198099631791",
      "gameName": "DARK SOULS™: REMASTERED",
      "achievements": [
        {
          "apiname": "ACHIEVEMENT_FRPG_ACHIEVEMENTS_00",
          "achieved": 0,
          "unlocktime": 0
        },
        {
          "apiname": "ACHIEVEMENT_FRPG_ACHIEVEMENTS_01",
          "achieved": 1,
          "unlocktime": 1726438602
        },
        ...,
      ],
    },
* }
 * RESPONSE:
 * {
 *   "response": {
 *     "complete": false,
 *     "next_boss": "Chaos Witch Quelaag",
 *     "recent_boss": "Bell Gargoyles"
 *   }
 * }
 */
router.get("/bosses/:steamid/:appid", async (req, res, next) => {
  try {
    let bosses;
    switch (req.params.appid) {
      case "570940":
        bosses = require("../schemas/bosses/darksoulsremastered.json");
        break;
      case "1245620":
        bosses = require("../schemas/bosses/eldenring.json");
        break;
      default:
        // Replace default case with an error response
        bosses = require("../schemas/bosses/darksoulsremastered.json");
        break;
    }

    const response = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${req.params.appid}&key=${process.env.API_KEY}&steamid=${req.params.steamid}`
    );
    if (!response.ok) {
      console.error(`Error: Received status ${response.status}`);
      return res.status(response.status).json({
        error: true,
        message: `Failed to fetch data with status ${response.status}`,
      });
    }
    const data = await response.json();
    const achievements = data.playerstats.achievements;
    console.log(achievements);
    // Loop through bosses in order. If a boss's achievement is not completed
    // in the player's achievements data, that's the next boss, and the boss at index-1
    // is the recent boss.
    for (const [index, boss] of bosses.entries()) {
      let currentBoss = achievements.find(
        (achievement) => achievement.apiname === boss.apiname
      );
      // Each game's bosses json only includes bosses with achievements associated,
      // so if currentBoss is undefined, it's a special case. Right now the only one
      // is with Elden Ring, where defeating the Elden Beast leads to 3 different
      // endings, each with their own achievement.
      if (typeof currentBoss === "undefined") {
        possibleAchievements = achievements.filter((achievement) =>
          boss.apiname.includes(achievement.apiname)
        );
        // If at least one of the achievements for beating the Elden Beast has been achieved,
        // That's the recent boss
        for (const achievement of possibleAchievements) {
          if (achievement.achieved) {
            // For this case, return a response. But if it's the case in Dark Souls 2 or 3,
            // or other future additions to this app, that there exists a boss with multiple
            // possible achievements that is NOT the final boss, that might not necessarily be
            // the recent boss, and this method would need refactoring
            return res.json({
              data: {
                complete: true,
                recent_boss: boss.name,
              },
            });
          }
        }
      }
      if (!currentBoss.achieved) {
        return res.json({
          data: {
            complete: false,
            next_boss: boss.name,
            recent_boss: bosses[index - 1].name,
          },
        });
      }
    }
    // Exit the for loop: Player has defeated all bosses.
    return res.json({
      response: {
        complete: true,
        recent_boss: bosses[bosses.length - 1],
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Usage: GET /bosses/:steamid/:appid
 * Route params:
 * - steamid (ex. 76561198099631791)
 * - appid (ex. 570940 for Dark Souls Remastered)
 * Uses Steam API endpoints:
 * https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid={req.params.appid}&key=${process.env.API_KEY}&steamid=${req.params.steamid}
 * - Query params:
 *   - key: API key
 *   - steamid
 *   - appid
 * https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=570940&format=json
 * - Query params:
 *   - gameid (appid)
 *   - format (json, xml)
 * STEAM API RESPONSE:
 * {
    "playerstats": {
      "steamID": "76561198099631791",
      "gameName": "DARK SOULS™: REMASTERED",
      "achievements": [
        {
          "apiname": "ACHIEVEMENT_FRPG_ACHIEVEMENTS_00",
          "achieved": 0,
          "unlocktime": 0
        },
        {
          "apiname": "ACHIEVEMENT_FRPG_ACHIEVEMENTS_01",
          "achieved": 1,
          "unlocktime": 1726438602
        },
        ...,
      ],
    },
  * }
 * RESPONSE:
{
  "response": {
    "achievements": [
      {
        "name": "Enkindle",
        "description": "Light bonfire flame.",
        "unlocktime": 1723589024,
        "icon": "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/570940/b3e4ca8626661bf2a67b7c207dae62088927bba7.jpg"
      },
      {
        "name": "Estus Flask",
        "description": "Acquire Estus Flask.",
        "unlocktime": 1723589520,
        "icon": "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/570940/1cef9627ae9f7f676d22343778b9b5f52d77c304.jpg"
      },
    ]
  }
}
 */
router.get("/achievements/:steamid/:appid", async (req, res, next) => {
  try {
    // Player achievement data
    const response = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${req.params.appid}&key=${process.env.API_KEY}&steamid=${req.params.steamid}`
    );
    if (!response.ok) {
      console.error(`Error: Received status ${response.status}`);
      return res.status(response.status).json({
        error: true,
        message: `Failed to fetch data with status ${response.status}`,
      });
    }
    const data = await response.json();
    const playerAchievements = data.playerstats.achievements;

    // Game schema data (never changes)
    let schema;
    switch (req.params.appid) {
      case "570940":
        schema = require("../schemas/darksoulsremastered_schema.json");
        break;
      case "1245620":
        schema = require("../schemas/eldenring_schema.json");
        break;
      default:
        // Replace default case with an error response
        schema = require("../schemas/darksoulsremasteredschema.json");
        break;
    }

    // Global achievement percentages (rarity)
    // Look into caching this somehow. These games aren't new, so the percentages aren't going to change often or by much.
    const percentagesResponse = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${req.params.appid}&format=json`
    );
    if (!percentagesResponse.ok) {
      console.error(`Error: Received status ${percentagesResponse.status}`);
      return res.status(percentagesResponse.status).json({
        error: true,
        message: `Failed to fetch data with status ${percentagesResponse.status}`,
      });
    }
    const percentagesData = await percentagesResponse.json();
    const percentages = percentagesData.achievementpercentages.achievements;

    // For each achievement:
    // - if its entry in achievements is achieved
    // - build a new object with its desired schema info
    // - find its object in percentagesData.achievements and add its percent as 'rarity'
    // - push to result
    result = [];
    schema.game.availableGameStats.achievements.forEach(function (
      achievement,
      index
    ) {
      if (playerAchievements[index].achieved) {
        let percentage = percentages.find(
          (percentage) => percentage.name === achievement.name
        ).percent;

        let resultAchievement = {
          name: achievement.displayName,
          description: achievement.description,
          unlocktime: new Date(
            playerAchievements[index].unlocktime * 1000
          ).toDateString(),
          icon: achievement.icon,
          rarity: percentage,
        };
        result.push(resultAchievement);
      }
    });

    return res.json({
      data: {
        result,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
