// Hardcoded fallback entries for real WC 2026 fixtures with known API IDs.
// These only show if the API fails to return them (e.g. network error, window mismatch).
// The API is the authoritative source for status/score — see HomeScreen merge logic.
export const MATCHES = [
  {
    id: 1489369,
    home: { name: 'Mexico', flag: 'mx', code: 'MEX' },
    away: { name: 'South Africa', flag: 'za', code: 'RSA' },
    status: 'UPCOMING',
    kickoff: 'TBD',
    venue: 'Estadio Azteca, Mexico City',
  },
  {
    id: 1489370,
    home: { name: 'USA', flag: 'us', code: 'USA' },
    away: { name: 'Paraguay', flag: 'py', code: 'PAR' },
    status: 'UPCOMING',
    kickoff: 'TBD',
    venue: 'MetLife Stadium, New Jersey',
  },
];

export const PLAYERS_BY_MATCH = {
  1489370: [
    // USA
    { id: 'usa-tur', name: 'Turner',    team: 'USA',      position: 'GK',  number: 1  },
    { id: 'usa-rob', name: 'Robinson',  team: 'USA',      position: 'DEF', number: 12 },
    { id: 'usa-ric', name: 'Richards',  team: 'USA',      position: 'DEF', number: 4  },
    { id: 'usa-rea', name: 'Ream',      team: 'USA',      position: 'DEF', number: 5  },
    { id: 'usa-des', name: 'Dest',      team: 'USA',      position: 'DEF', number: 2  },
    { id: 'usa-ada', name: 'Adams',     team: 'USA',      position: 'MID', number: 4  },
    { id: 'usa-mck', name: 'McKennie', team: 'USA',      position: 'MID', number: 8  },
    { id: 'usa-mus', name: 'Musah',     team: 'USA',      position: 'MID', number: 6  },
    { id: 'usa-pul', name: 'Pulisic',   team: 'USA',      position: 'FWD', number: 10 },
    { id: 'usa-bal', name: 'Balogun',   team: 'USA',      position: 'FWD', number: 9  },
    { id: 'usa-wea', name: 'Weah',      team: 'USA',      position: 'FWD', number: 21 },
    // Paraguay
    { id: 'par-sil', name: 'Silva',      team: 'Paraguay', position: 'GK',  number: 1  },
    { id: 'par-gom', name: 'Gomez',      team: 'Paraguay', position: 'DEF', number: 3  },
    { id: 'par-ald', name: 'Alderete',   team: 'Paraguay', position: 'DEF', number: 4  },
    { id: 'par-bal', name: 'Balbuena',   team: 'Paraguay', position: 'DEF', number: 5  },
    { id: 'par-vil', name: 'Villasanti', team: 'Paraguay', position: 'MID', number: 6  },
    { id: 'par-alm', name: 'Almiron',    team: 'Paraguay', position: 'MID', number: 10 },
    { id: 'par-enc', name: 'Enciso',     team: 'Paraguay', position: 'MID', number: 11 },
    { id: 'par-gal', name: 'Galarza',    team: 'Paraguay', position: 'MID', number: 8  },
    { id: 'par-san', name: 'Sanabria',   team: 'Paraguay', position: 'FWD', number: 9  },
    { id: 'par-sos', name: 'Sosa',       team: 'Paraguay', position: 'FWD', number: 7  },
    { id: 'par-gim', name: 'Gimenez',    team: 'Paraguay', position: 'FWD', number: 19 },
  ],
  1489369: [
    // Mexico
    { id: 'mex-och', name: 'Ochoa',    team: 'Mexico',       position: 'GK',  number: 13 },
    { id: 'mex-san', name: 'Sanchez',  team: 'Mexico',       position: 'DEF', number: 22 },
    { id: 'mex-mor', name: 'Moreno',   team: 'Mexico',       position: 'DEF', number: 3  },
    { id: 'mex-gal', name: 'Gallardo', team: 'Mexico',       position: 'DEF', number: 23 },
    { id: 'mex-her', name: 'Herrera',  team: 'Mexico',       position: 'MID', number: 16 },
    { id: 'mex-gua', name: 'Guardado', team: 'Mexico',       position: 'MID', number: 18 },
    { id: 'mex-veg', name: 'Vega',     team: 'Mexico',       position: 'MID', number: 8  },
    { id: 'mex-alv', name: 'Alvarado', team: 'Mexico',       position: 'MID', number: 19 },
    { id: 'mex-loz', name: 'Lozano',   team: 'Mexico',       position: 'FWD', number: 22 },
    { id: 'mex-jim', name: 'Jimenez',  team: 'Mexico',       position: 'FWD', number: 9  },
    { id: 'mex-ant', name: 'Antuna',   team: 'Mexico',       position: 'FWD', number: 21 },
    // South Africa
    { id: 'rsa-wil', name: 'Williams', team: 'South Africa', position: 'GK',  number: 1  },
    { id: 'rsa-bro', name: 'Broos',    team: 'South Africa', position: 'DEF', number: 5  },
    { id: 'rsa-mok', name: 'Mokoena',  team: 'South Africa', position: 'DEF', number: 3  },
    { id: 'rsa-zun', name: 'Zungu',    team: 'South Africa', position: 'MID', number: 8  },
    { id: 'rsa-mod', name: 'Modise',   team: 'South Africa', position: 'MID', number: 10 },
    { id: 'rsa-dol', name: 'Dolly',    team: 'South Africa', position: 'MID', number: 11 },
    { id: 'rsa-zwa', name: 'Zwane',    team: 'South Africa', position: 'MID', number: 7  },
    { id: 'rsa-tau', name: 'Tau',      team: 'South Africa', position: 'FWD', number: 13 },
    { id: 'rsa-mot', name: 'Mothiba',  team: 'South Africa', position: 'FWD', number: 9  },
    { id: 'rsa-lak', name: 'Lakay',    team: 'South Africa', position: 'FWD', number: 19 },
    { id: 'rsa-hlo', name: 'Hlongwane',team: 'South Africa', position: 'FWD', number: 14 },
  ],
  1: [
    // Brazil players
    { id: 'v', name: 'Vinícius Jr.', team: 'Brazil', position: 'FWD', number: 7 },
    { id: 'ro', name: 'Rodrygo', team: 'Brazil', position: 'FWD', number: 11 },
    { id: 'ra', name: 'Raphinha', team: 'Brazil', position: 'MID', number: 10 },
    { id: 'ca', name: 'Casemiro', team: 'Brazil', position: 'MID', number: 5 },
    { id: 'da', name: 'Danilo', team: 'Brazil', position: 'DEF', number: 2 },
    { id: 'ma', name: 'Marquinhos', team: 'Brazil', position: 'DEF', number: 4 },
    { id: 'al', name: 'Alisson', team: 'Brazil', position: 'GK', number: 1 },
    // Germany players
    { id: 'ka', name: 'Kane', team: 'Germany', position: 'FWD', number: 9 },
    { id: 'mu', name: 'Müller', team: 'Germany', position: 'MID', number: 13 },
    { id: 'ha', name: 'Havertz', team: 'Germany', position: 'MID', number: 8 },
    { id: 'ru', name: 'Rüdiger', team: 'Germany', position: 'DEF', number: 2 },
    { id: 'ne', name: 'Neuer', team: 'Germany', position: 'GK', number: 1 },
  ],
  2: [
    // Argentina players
    { id: 'me', name: 'Messi', team: 'Argentina', position: 'FWD', number: 10 },
    { id: 'lm', name: 'Lautaro', team: 'Argentina', position: 'FWD', number: 22 },
    { id: 'dpm', name: 'Di María', team: 'Argentina', position: 'MID', number: 11 },
    { id: 'mac', name: 'Mac Allister', team: 'Argentina', position: 'MID', number: 20 },
    { id: 'rom', name: 'Romero', team: 'Argentina', position: 'DEF', number: 13 },
    { id: 'mar', name: 'Martínez (GK)', team: 'Argentina', position: 'GK', number: 23 },
    // France players
    { id: 'mb', name: 'Mbappé', team: 'France', position: 'FWD', number: 10 },
    { id: 'gr', name: 'Griezmann', team: 'France', position: 'FWD', number: 7 },
    { id: 'tc', name: 'Tchouaméni', team: 'France', position: 'MID', number: 8 },
    { id: 'km', name: 'Konaté', team: 'France', position: 'DEF', number: 5 },
    { id: 'hug', name: 'Hernandez', team: 'France', position: 'DEF', number: 22 },
    { id: 'mai', name: 'Maignan', team: 'France', position: 'GK', number: 16 },
  ],
  3: [
    // England players
    { id: 'bel', name: 'Bellingham', team: 'England', position: 'MID', number: 10 },
    { id: 'sal', name: 'Saka', team: 'England', position: 'FWD', number: 7 },
    { id: 'fod', name: 'Foden', team: 'England', position: 'MID', number: 8 },
    { id: 'wal', name: 'Walker', team: 'England', position: 'DEF', number: 2 },
    { id: 'mag', name: 'Maguire', team: 'England', position: 'DEF', number: 6 },
    { id: 'pic', name: 'Pickford', team: 'England', position: 'GK', number: 1 },
    // Spain players
    { id: 'yam', name: 'Yamal', team: 'Spain', position: 'FWD', number: 19 },
    { id: 'oli', name: 'Olmo', team: 'Spain', position: 'MID', number: 8 },
    { id: 'ped', name: 'Pedri', team: 'Spain', position: 'MID', number: 16 },
    { id: 'car', name: 'Carvajal', team: 'Spain', position: 'DEF', number: 2 },
    { id: 'lag', name: 'Le Normand', team: 'Spain', position: 'DEF', number: 5 },
    { id: 'sim', name: 'Simón', team: 'Spain', position: 'GK', number: 23 },
  ],
  4: [
    // Portugal
    { id: 'cr', name: 'Ronaldo', team: 'Portugal', position: 'FWD', number: 7 },
    { id: 'bru', name: 'B. Fernandes', team: 'Portugal', position: 'MID', number: 8 },
    { id: 'leo', name: 'Leão', team: 'Portugal', position: 'FWD', number: 11 },
    { id: 'rub', name: 'Rúben Dias', team: 'Portugal', position: 'DEF', number: 4 },
    { id: 'cos', name: 'Costa', team: 'Portugal', position: 'MID', number: 16 },
    { id: 'pat', name: 'Patrício', team: 'Portugal', position: 'GK', number: 1 },
    // Netherlands
    { id: 'dep', name: 'Depay', team: 'Netherlands', position: 'FWD', number: 10 },
    { id: 'gav', name: 'Gakpo', team: 'Netherlands', position: 'FWD', number: 11 },
    { id: 'dev', name: 'De Jong', team: 'Netherlands', position: 'MID', number: 21 },
    { id: 'ake', name: 'Aké', team: 'Netherlands', position: 'DEF', number: 5 },
    { id: 'van', name: 'van Dijk', team: 'Netherlands', position: 'DEF', number: 4 },
    { id: 'fla', name: 'Flekken', team: 'Netherlands', position: 'GK', number: 1 },
  ],
  5: [
    // USA
    { id: 'pul', name: 'Pulisic', team: 'USA', position: 'FWD', number: 10 },
    { id: 'wei', name: 'Weah', team: 'USA', position: 'FWD', number: 21 },
    { id: 'mus', name: 'Musah', team: 'USA', position: 'MID', number: 8 },
    { id: 'tur', name: 'Turner', team: 'USA', position: 'GK', number: 1 },
    { id: 'des', name: 'Dest', team: 'USA', position: 'DEF', number: 2 },
    { id: 'rem', name: 'Reyna', team: 'USA', position: 'MID', number: 7 },
    // Mexico
    { id: 'chi', name: 'Chicharito', team: 'Mexico', position: 'FWD', number: 14 },
    { id: 'jib', name: 'Jiménez', team: 'Mexico', position: 'FWD', number: 9 },
    { id: 'haj', name: 'Herrera', team: 'Mexico', position: 'MID', number: 16 },
    { id: 'moreno', name: 'Moreno', team: 'Mexico', position: 'DEF', number: 3 },
    { id: 'och', name: 'Ochoa', team: 'Mexico', position: 'GK', number: 13 },
    { id: 'alv', name: 'Álvarez', team: 'Mexico', position: 'MID', number: 14 },
  ],
};
