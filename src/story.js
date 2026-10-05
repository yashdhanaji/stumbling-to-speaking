// story: the 14 scenes as a quest chain. Text is upper-cased ASCII so it fits the 5x7 font.
// Actions: {say, text} {game} {warp:[map,x,y,dir]} {cut:{frames,bonus}} {conf} {when,then,else} {fn} {end}
var G = (globalThis.G ||= {}); // var, not const: browser scripts share one global scope
G.Story = (() => {
  const COLS = 23;   // characters per line in the dialogue box (leaves a clear margin inside the border)
  const norm = s => s.toUpperCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[—–]/g, '-').replace(/[→▸]/g, '>');
  const say = (who, text) => ({ say: norm(who), text: norm(text) });
  const N = t => say('', t);                      // narration: no name tag
  const CONF_GATE = 50;                           // Scene 13 branches on this

  const STEPS = [
    // S1 - put on the spot
    { id: 'manager', type: 'talk', at: { map: 'office', id: 'manager' }, script: [
      N('A TEAM MEETING. YOU ARE LISTENING QUIETLY.'),
      say('Manager', "Alright, let's hear from you. Could you quickly present this idea to the team?"),
      N('You were not ready. Your mind goes blank. Dodge the filler words!'),
      { game: 'stumble' },
      say('Manager', 'Okay, take your time.'),
      N('You manage a very fragmented explanation. The silence afterwards is long. The meeting ends.'),
      { warp: ['corridor', 1, 3, 'right'] },
      // S2 - what just happened
      say('You', 'I knew what I wanted to say. I had the idea in my head.'),
      say('You', "So why couldn't I communicate it?"),
      N('Colleagues talk with ease. A poster at the end of the hall catches your eye.'),
    ] },
    // S3 - the discovery
    { id: 'poster', type: 'talk', at: { map: 'corridor', id: 'poster' }, script: [
      say('Poster', 'TOASTMASTERS'),
      say('Poster', "Stumble when you're put on the spot? Struggle to put your thoughts into words? Want to build confidence and leadership skills?"),
      say('Poster', "You don't have to be a great speaker to start. You become a better speaker by practising. Welcome to Toastmasters."),
      N('You open the door at the end of the hall.'),
    ] },
    // S4 - what happens inside
    { id: 'enter_club', type: 'door', warp: { map: 'corridor', x: 23, y: 3 }, onEnter: [
      N('A speech is under way. A Toastmaster of the Day, an Evaluator, a Grammarian, an Ah-Counter and a Timer run the room.'),
    ] },
    { id: 'host', type: 'talk', at: { map: 'club', id: 'host' }, script: [
      say('Host', 'Welcome! First time at Toastmasters?'),
      say('You', 'Yes. I was looking to get better at communicating.'),
      say('Host', "Then you've come to the right place. Let me show you how it works."),
      // S5 - prepared speaking
      say('Host', "That's a prepared speech. Members work on speeches through learning paths, building communication and leadership skills."),
      say('You', 'Learning paths?'),
      say('Host', 'Yes. Take the door on the far left.'),
    ] },
    // S6 - the pathways corridor
    { id: 'pathways_door', type: 'door', warp: { map: 'club', x: 3, y: 1 }, onEnter: [N('Six doors. Open each one.')] },
    { id: 'doors', type: 'collect', map: 'pathways', bonus: 5, items: {
      door1: [say('Door 1', 'DYNAMIC LEADERSHIP. Build leadership, conflict-management and collaboration skills.')],
      door2: [say('Door 2', 'EFFECTIVE COACHING. Develop skills to motivate, support and guide others.')],
      door3: [say('Door 3', 'ENGAGING HUMOR. Learn to use humor effectively in communication.')],
      door4: [say('Door 4', 'INNOVATIVE PLANNING. Strengthen planning, project management and communication.')],
      door5: [say('Door 5', 'LEADERSHIP DEVELOPMENT. Build leadership presence and team-management skills.')],
      door6: [say('Door 6', 'PRESENTATION MASTERY. Strengthen public speaking and presentation skills.')],
    }, after: [
      say('You', "So the speeches aren't just speeches?"),
      say('Host', "Exactly. They're structured opportunities to build specific skills."),
    ] },
    { id: 'leave_hall', type: 'door', warp: { map: 'pathways', x: 6, y: 6 }, onEnter: [] },
    // S7 - table topics
    { id: 'ttm', type: 'talk', at: { map: 'club', id: 'ttm' }, script: [
      say('You', "My biggest problem wasn't preparing a speech. It was when my manager suddenly asked me to speak."),
      say('Host', "That's where Table Topics comes in."),
      say('Topics Master', 'Your topic is: Tell us about a time you failed and what you learnt from it. You have two minutes.'),
      say('Host', 'No preparation time. You get a topic, a few seconds to think, and you speak. Your turn.'),
      { game: 'topics' },
      say('Table Topics', 'Think > Organize > Speak. Build spontaneity, confidence and the ability to think on your feet.'),
    ] },
    // S8 - evaluation
    { id: 'eval', type: 'talk', at: { map: 'club', id: 'evaluator' }, script: [
      N('A prepared speech ends. The Evaluator stands.'),
      say('Evaluator', 'One thing that worked really well was your opening. It immediately got our attention.'),
      say('Evaluator', 'Now you try. Catch the feedback that helps a speaker improve.'),
      { game: 'feedback' },
      say('You', 'So someone evaluates every speech?'),
      say('Host', 'Yes. Because speaking is only half the journey. Knowing how to improve is the other half.'),
      say('Evaluation', 'Speak > Receive feedback > Improve > Speak again.'),
    ] },
    // S9 - everyone has a role
    { id: 'roles', type: 'collect', map: 'club', bonus: 0, items: {
      tod: [say('Toastmaster', 'I am the Toastmaster of the Day. I plan and conduct the meeting.')],
      timer: [
        say('Timer', 'I am the Timer. I keep everyone within their allotted time. Hold up the cards at the right moments!'),
        { game: 'timercards' },
      ],
      grammarian: [say('Grammarian', 'I am the Grammarian. I listen for language usage and introduce the Word of the Day.')],
      ahcounter: [
        say('Ah-Counter', 'I am the Ah-Counter. I track filler words and verbal crutches. Help me swat the ums!'),
        { game: 'ahcounter' },
      ],
      geneval: [say('Gen Evaluator', 'I am the General Evaluator. I look at the meeting as a whole.')],
    }, after: [
      say('Host', "You don't just attend a Toastmasters meeting."),
      say('Host', 'You help run one. Now meet the club leaders. Door on the far right.'),
    ] },
    // S10 - the leadership layer
    { id: 'officers_door', type: 'door', warp: { map: 'club', x: 16, y: 1 }, onEnter: [N("The club's leadership team. Meet all seven.")] },
    { id: 'officers', type: 'collect', map: 'officers', bonus: 5, items: {
      president: [say('President', 'I provide overall leadership and direction to the club.')],
      vpe: [say('VP Education', 'I help members plan their learning journey, speeches and roles.')],
      vpm: [say('VP Membership', 'I focus on welcoming and engaging members.')],
      vppr: [say('VP Pub Relations', "I build awareness and communicate the club's activities.")],
      secretary: [say('Secretary', 'I manage club records and communication.')],
      treasurer: [say('Treasurer', "I manage the club's finances.")],
      saa: [say('Sgt at Arms', 'I manage the meeting environment and logistics.')],
    }, after: [
      N('They plan meetings, speech schedules, membership, contests, events and club goals.'),
      say('Host', "Leadership here isn't theoretical. You take responsibility, coordinate people, solve problems and make things happen."),
    ] },
    { id: 'leave_officers', type: 'door', warp: { map: 'officers', x: 6, y: 8 }, onEnter: [] },
    // S11 - mentorship, S12 - practice montage, then back to the office for S13
    { id: 'mentor', type: 'talk', at: { map: 'club', id: 'mentor' }, script: [
      say('You', "This sounds great, but what if I don't know how to do all of this?"),
      say('Mentor', "Your structure was strong. Next time, let's work on your opening."),
      say('Mentor', 'And before your next speech, try practising it once without your notes.'),
      say('Mentor', "You don't have to figure it out alone. Let's rehearse. Press A on the beat."),
      { game: 'rehearse' },
      say('Mentorship', 'Guidance > Practice > Feedback > Growth.'),
      { cut: { bonus: 10, frames: [
        'You give a prepared speech.', 'You answer a Table Topic.', 'You take the Timer role.', 'You become Grammarian.',
        'You evaluate another speaker.', 'You serve as Toastmaster of the Day.', 'You join a leadership meeting.',
        'You are mentored, and you speak again.', 'You lead a meeting. Applause.',
      ].map(norm) } },
      say('Voiceover', 'You practise speaking.'),
      say('Voiceover', 'You practise thinking on your feet.'),
      say('Voiceover', 'You learn to give and receive feedback.'),
      say('Voiceover', 'You learn to organise and conduct meetings.'),
      say('Voiceover', 'You take responsibility. You lead. And you keep improving.'),
      { warp: ['office', 5, 8, 'up'] },
      N('The same conference room. The same manager.'),
    ] },
    // S13 - the circle comes back; S14 - the final message
    { id: 'finale', type: 'talk', at: { map: 'office', id: 'manager' }, script: s => [
      say('Manager', 'Alright, could you present this idea to the team?'),
      { when: st => st.conf >= CONF_GATE,
        then: [
          { fn: st => { st.flags.ending = 'confident'; } },
          N('You take a breath. No hesitation.'), say('You', 'Absolutely.'),
          { game: 'present', opts: { steady: true } },
          { when: st => st.flags.breathed, then: [N('You pause and breathe. The answer comes clearly.')] },
          say('You', 'Based on these points, I recommend we move forward with this approach.'),
          N('A moment of silence.'),
          say('Manager', "Good. That's a clear recommendation. Let's take this forward."),
        ],
        else: [
          { fn: st => { st.flags.ending = 'growing'; } },
          say('You', 'Give me a moment.'),
          { game: 'present', opts: { steady: false } },
          { when: st => st.flags.breathed, then: [N('You pause and breathe. The answer comes clearly.')] },
          N('You breathe and name three points: the challenge, the solution, the impact. It is not perfect, but you finish.'),
          say('Manager', "That's clear enough. Let's keep working on it."),
          N('You are steadier than before. Growth comes from practice, so keep showing up.'),
        ] },
      { cut: { bonus: 0, frames: [
        'The office slowly becomes the Toastmasters meeting room. The two worlds merge.',
        "The goal isn't to become someone who never gets nervous.",
        'The goal is to become someone who can communicate even when they are.',
        'TOASTMASTERS. Speak. Practise. Lead. Grow.',
      ].map(norm) } },
      { end: true },
    ] },
  ];
  const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.id, i]));

  // what people say when it is not their turn in the quest (cycled)
  const IDLE = {
    manager: ['LET ME KNOW WHEN YOU ARE READY.'],
    pal1: ["...AND THAT'S MY PROPOSAL. DONE!", 'WE NAILED THE PITCH TODAY.'],
    pal2: ['I JUST ASKED THE BOARD FOR A RAISE.', 'IMPROMPTU TALKS ARE FUN, REALLY.'],
    pal3: ['DID YOU SEE THE POSTER AT THE END OF THE HALL?', 'IT HELPED ME A LOT.'],
    host: ['HOW ARE YOU FINDING IT SO FAR?', 'KEEP GOING. YOU ARE DOING GREAT.'],
    ttm: ['TABLE TOPICS ARE ABOUT THINKING ON YOUR FEET.', 'GOOD TO SEE YOU AGAIN!'],
    evaluator: ['FEEDBACK IS A GIFT.', 'EVERY SPEECH CAN IMPROVE.'],
    tod: ["I'M BUSY RUNNING THE MEETING.", 'ONE MOMENT PLEASE.'],
    timer: ['EVERYONE KEEPS TO TIME HERE.', 'GREEN, YELLOW, RED. EASY.'],
    grammarian: ["TODAY'S WORD IS: ARTICULATE.", 'LANGUAGE MATTERS.'],
    ahcounter: ['UM... I MEAN, NOTHING!', 'I COUNT THE UMS.'],
    geneval: ['I SEE THE WHOLE MEETING.', 'KEEP PRACTISING!'],
    mentor: ['I BELIEVE IN YOU.', 'PRACTISE, THEN SPEAK AGAIN.'],
    president: ['WELCOME TO THE CLUB!'], vpe: ['LET US PLAN YOUR NEXT SPEECH.'], vpm: ['WE LOVE NEW MEMBERS.'],
    vppr: ['SPREAD THE WORD!'], secretary: ['ALL IN THE RECORDS.'], treasurer: ['THE BOOKS ARE BALANCED.'], saa: ['ROOM IS READY.'],
    poster: ['TOASTMASTERS. SPEAK. PRACTISE. LEAD. GROW.'],
    door1: ['LEADERSHIP IS PRACTISED HERE.'], door2: ['COACHING OTHERS HELPS YOU GROW.'], door3: ['A LITTLE HUMOR GOES FAR.'],
    door4: ['GOOD PLANS START HERE.'], door5: ['LEAD A MEETING, BUILD PRESENCE.'], door6: ['SPEAK WITH IMPACT.'],
  };
  for (const k of Object.keys(IDLE)) IDLE[k] = IDLE[k].map(norm);
  const HINT = [N('Walk with the arrows. Press A to talk to the person with the ! above them.')];   // shown once, at the start of a new game
  return { COLS, CONF_GATE, STEPS, STEP_INDEX, IDLE, HINT, norm, say };
})();
if (typeof module !== 'undefined') module.exports = G.Story;
