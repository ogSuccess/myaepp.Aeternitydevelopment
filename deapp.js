const contractSource = `
contract ProjectVote =
record project =
  { creatorAddress : address,
    url            : string,
    name           : string,
    voteCount      : int }
record state =
  { projects      : map(int, project),
    projectsLength : int }
function init() =
  { projects = {},
    projectsLength = 0 }
public function getProject(index : int) : project =
  switch(Map.lookup(index, state.projects))
    None    => abort("There was no project with this index registered.")
    Some(x) => x
public stateful function registerProject(url' : string, name' : string) =
  let project = { creatorAddress = Call.caller, url = url', name = name', voteCount = 0}
  let index = getProjectsLength() + 1
  put(state{ projects[index] = project, projectsLength = index })
public function getProjectsLength() : int =
  state.projectsLength
public stateful function voteProject(index : int) =
  let project = getProject(index)
  Chain.spend(project.creatorAddress, Call.value)
  let updatedVoteCount = project.voteCount + Call.value
  let updatedProjects = state.projects{ [index].voteCount = updatedVoteCount }
  put(state{ projects = updatedProjects })
`;

//Address of the meme voting smart contract on the testnet of the aeternity blockchain
const contractAddress = 'ct_6XLoWEeJ9yeyLLHJutzrkB9VyqyRdXwpDSTbgcJks64Qvd7xP';
//Create variable for client so it can be used in different functions
var client = null;
//Create a new global array for the memes
var projectArray = [];
//Create a new variable to store the length of the meme globally
var projectsLength = 0;

function renderProjects() {
  //Order the memes array so that the meme with the most votes is on top
  projectArray = projectArray.sort(function(a,b){return b.votes-a.votes})
  //Get the template we created in a block scoped variable
  let template = $('#template').html();
  //Use mustache parse function to speeds up on future uses
  Mustache.parse(template);
  //Create variable with result of render func form template and data
  let rendered = Mustache.render(template, {projectArray});
  //Use jquery to add the result of the rendering to our html
  $('#projectBody').html(rendered);
}

//Create a asynchronous read call for our smart contract
async function callStatic(func, args) {
  //Create a new contract instance that we can interact with
  const contract = await client.getContractInstance(contractSource, {contractAddress});
  //Make a call to get data of smart contract func, with specefied arguments
  const calledGet = await contract.call(func, args, {callStatic: true}).catch(e => console.error(e));
  //Make another call to decode the data received in first call
  const decodedGet = await calledGet.decode().catch(e => console.error(e));

  return decodedGet;
}

//Create a asynchronous write call for our smart contract
async function contractCall(func, args, value) {
  const contract = await client.getContractInstance(contractSource, {contractAddress});
  //Make a call to write smart contract func, with aeon value input
  const calledSet = await contract.call(func, args, {amount: value}).catch(e => console.error(e));

  return calledSet;
}

//Execute main function
window.addEventListener('load', async () => {
  //Display the loader animation so the user knows that something is happening
  $("#loader").show();

  //Initialize the Aepp object through aepp-sdk.browser.js, the base app needs to be running.
  client = await Ae.Aepp();

  //First make a call to get to know how may memes have been created and need to be displayed
  //Assign the value of meme length to the global variable
  projectsLength = await callStatic('getProjectsLength', []);

  //Loop over every meme to get all their relevant information
  for (let i = 1; i <= projectsLength; i++) {

    //Make the call to the blockchain to get all relevant information on the meme
    const project = await callStatic('getProject', [i]);

    //Create meme object with  info from the call and push into the array with all memes
    projectArray.push({
      creatorName: project.name,
      projectUrl: project.url,
      index: i,
      votes: project.voteCount,
    })
  }

  //Display updated memes
  renderProjects();

  //Hide loader animation
  $("#loader").hide();
});

//If someone clicks to vote on a meme, get the input and execute the voteCall
jQuery("#projectBody").on("click", ".voteBtn", async function(event){
  $("#loader").show();
  //Create two new let block scoped variables, value for the vote input and
  //index to get the index of the meme on which the user wants to vote
  let value = $(this).siblings('input').val(),
      index = event.target.id;

  //Promise to execute execute call for the vote meme function with let values
  await contractCall('voteProject', [index], value);

  //Hide the loading animation after async calls return a value
  const foundIndex = projectArray.findIndex(project => project.index == event.target.id);
  //console.log(foundIndex);
  projectArray[foundIndex].votes += parseInt(value, 10);

  renderProjects();
  $("#loader").hide();
});

//If someone clicks to register a meme, get the input and execute the registerCall
$('#registerBtn').click(async function(){
  $("#loader").show();
  //Create two new let variables which get the values from the input fields
  const name = ($('#regName').val()),
        url = ($('#regUrl').val());

  //Make the contract call to register the meme with the newly passed values
  await contractCall('registerProject', [url, name], 0);

  //Add the new created memeobject to our memearray
  projectArray.push({
    creatorName: name,
    projectUrl: url,
    index: projectArray.length+1,
    votes: 0,
  })

  renderProjects();
  $("#loader").hide();
});