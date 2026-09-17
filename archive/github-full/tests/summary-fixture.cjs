// Synthetic data only. No real event, credential or participant is committed.
module.exports = function fixture() {
  const titles = ['Riunione Giuria','Inizio Punzonatura','Controllo Percorso','Fine Punzonatura','Imbarco Giudici','Check Radio','Riunione Tecnica Ragazzi','Partenza Rag M','Partenza Rag F','Riunione Tecnica Jun','Partenza Jun M','Partenza Jun F','Premiazioni'];
  const times = ['06:30','07:00','07:30','08:15','08:30','08:20','08:30','09:00','09:05','10:15','10:45','10:50','12:30'];
  const groups = [
    ['Fase di preparazione',['Controllo Costumi/Unghie/Cuffia','Controllo Tessere','Consegna Transponder','Controllo Percorso','Consegna Radio + Documentazione']],
    ['Preparazione partenza',['Apri Fila','Chiudi Fila','Responsabile Timing','Responsabile Entrata in acqua']],
    ['In acqua',['Giudice Arbitro 1','Barca 1','Barca 2','Giudice Arbitro 2','Barca 3','Barca 4']],
    ['A terra',['Responsabile Arrivi','Arrivi','Recorder','Video Review','Riconsegna Tessere']]
  ];
  return {
    version:3, id:'TEST-PRINT', event:{name:'Gara dimostrativa 5 KM',date:'2026-09-19',venue:'Impianto dimostrativo',notes:'',athleteTotal:135,athleteDescription:'',
      athleteDepartures:['Rag M','Rag W','Jun M','Jun W'].map((name,i)=>({id:'d'+i,name,athletes:[33,33,34,35][i],numbers:['Dal 1 al 33','Dal 58 al 83','Dal 101 al 134','Dal 151 al 185'][i],notes:''})),
      pathNotes:'Percorso di 5 km: 3 giri da percorrere in senso orario.\n4 boe obbligatorie da lasciare a destra.'},
    timeline:titles.map((title,i)=>({id:'t'+i,time:times[i],title,place:'',notes:title.startsWith('Partenza')?'Entrata in acqua tre minuti prima':''})),
    officials:Array.from({length:12},(_,i)=>({id:'u'+i,name:'Ufficiale dimostrativo '+(i+1),notes:''})),
    roleCategories:groups.map(([name,roles],c)=>({id:'c'+c,name,roles:roles.map((name,i)=>({id:`r${c}-${i}`,name,officialIds:[`u${(c+i)%12}`, ...(i===1?['u11']:[])]}))})),
    refereeNotes:{briefingAthletes:'',briefingJury:'',checklist:[]}
  };
};
