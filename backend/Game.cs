using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;
using System.IO;
using System.Collections.Concurrent;
using System.Timers;
using System;
using ServiceStack.Redis;

namespace Twaddle {
    class Room {
        public string id { get; set; }
        public string name { get; set; }
        public Dictionary<string, string> players { get; set; }
        public Dictionary<string, string> answers { get; set; }
        public Dictionary<string, int> playerChoices { get; set; }
    }

    interface ITimerService {
        Task RunLater(Func<IHubContext<GameHub>, Task> work);
    }

    class TimerService : ITimerService {
        IHubContext<GameHub> hub;

        public TimerService(IHubContext<GameHub> hubContext) {
            if (hubContext == null) throw new ArgumentNullException(nameof(hubContext));
            this.hub = hubContext;
        }

        public Task RunLater(Func<IHubContext<GameHub>, Task> work) {
            return Task.Run(async () => {
                await work(hub);
            });
        }

    }

    class GameHub : Hub {
        private static List<KeyValuePair<string, string>> groundTruth;

        private readonly ITimerService timers;

        //TODO: remove these (probably)
        private System.Random rng;
        private IRedisClientAsync redis;

        public GameHub(ITimerService timerService) {
            if (timerService == null) throw new ArgumentNullException(nameof(timerService));
            this.timers = timerService;

            redis = new RedisClient();
            rng = new System.Random();
            if (groundTruth == null)
            {
                using (var file = File.OpenRead("words.json"))
                {
                    var dictT = JsonSerializer.DeserializeAsync<Dictionary<string, string>>(file);
                    groundTruth = new List<KeyValuePair<string, string>>(dictT.Result);
                }
            }
        }

        public async Task<Room> CreateRoom(string roomName, string playerName) {
            var room = new Room() {
                id = Guid.NewGuid().ToString(),
                name = roomName,
                players = new Dictionary<string, string>(),
                answers = new Dictionary<string, string>(),
                playerChoices = new Dictionary<string, int>()
            };
            room.players[Context.ConnectionId] = playerName;
            await redis.AddAsync(room.id, room);
            await Groups.AddToGroupAsync(Context.ConnectionId, room.id);
            return room;
        }

        public async Task<Room> JoinRoom(string roomId, string playerName) {
            var room = await redis.GetAsync<Room>(roomId);
            room.players[Context.ConnectionId] = playerName;
            await redis.SetAsync(room.id, room);
            await Groups.AddToGroupAsync(Context.ConnectionId, room.id);
            await Clients.OthersInGroup(room.id).SendAsync("PlayerJoined", Context.ConnectionId, playerName);
            return room;
        }

        public async Task StartRound(string roomId) {
            var room = await redis.GetAsync<Room>(roomId);
            int ix = rng.Next(groundTruth.Count);
            var word = groundTruth[ix].Key;
            await Clients.Group(room.id).SendAsync("RoundStarted", word);
            _ = timers.RunLater(async (hubContext) => {
                try {
                    await Task.Delay(30 * 1000);
                    IRedisClientAsync redis = new RedisClient();
                    var options = new List<string>((await redis.GetAsync<Room>(roomId)).answers.Values);
                    options.Add(groundTruth[ix].Value);
                    await hubContext.Clients.Group(room.id).SendAsync("SubmitDefnEnded", options);
                    _ = timers.RunLater(async (hubContext) => {
                        await Task.Delay(30 * 1000);
                        IRedisClientAsync redis = new RedisClient();
                        var chosen = 0;
                        await hubContext.Clients.Group(room.id).SendAsync("SubmitChoiceEnded", chosen);
                    });
                } catch(Exception ex) {
                    System.Console.Out.WriteLine(ex.Message);
                    System.Console.Out.WriteLine(ex.StackTrace);
                }
            });
            return;
        }

        public async Task SubmitDefn(string roomId, string answer) {
            //TODO: check timer isn't expired
            var room = await redis.GetAsync<Room>(roomId);
            room.answers[Context.ConnectionId] = answer;
            await redis.SetAsync(room.id, room);
        }

        public async Task SubmitChoice(string roomId, int index) {
            //TODO: check timer isn't expired
            var room = await redis.GetAsync<Room>(roomId);
        }
    }
}